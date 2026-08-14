import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../services/audit.service';

export interface UserRequest extends Request {
  user?: {
    sub: string;
    email: string;
    fullName?: string;
    role: string;
    hospitalId?: string;
  };
}

const ROUTE_META: Record<string, { module: string; entity: string }> = {
  medicines:          { module: 'Medicines',     entity: 'Medicine'        },
  inventory:          { module: 'Inventory',     entity: 'StockBatch'      },
  batches:            { module: 'Inventory',     entity: 'StockBatch'      },
  prescriptions:      { module: 'Prescriptions', entity: 'Prescription'    },
  issuance:           { module: 'Issuance',      entity: 'IssueTransaction' },
  transfers:          { module: 'Transfers',     entity: 'TransferRequest'  },
  patients:           { module: 'Patients',      entity: 'Patient'         },
  visits:             { module: 'Visits',        entity: 'Visit'           },
  users:              { module: 'Users',         entity: 'User'            },
  pharmacies:         { module: 'Pharmacies',    entity: 'Pharmacy'        },
  hospitals:          { module: 'Hospitals',     entity: 'Hospital'        },
  departments:        { module: 'Departments',   entity: 'Department'      },
  admissions:         { module: 'Admissions',    entity: 'Admission'       },
  'lab-orders':       { module: 'Lab Orders',    entity: 'LabOrder'        },
  'lab-tests':        { module: 'Lab Tests',     entity: 'LabTest'         },
  payments:           { module: 'Payments',      entity: 'Payment'         },
  receipts:           { module: 'Receipts',      entity: 'Receipt'         },
  grn:                { module: 'Inventory',     entity: 'GRN'             },
  'purchase-orders':  { module: 'Inventory',     entity: 'PurchaseOrder'   },
  backups:            { module: 'Backups',       entity: 'Backup'          },
};

const METHOD_ACTION: Record<string, string> = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

// Custom action endpoints (e.g. POST /transfers/:id/dispatch) should be logged
// with the REAL action the user performed, not the generic HTTP-method action.
// Only whitelisted trailing path segments are treated as sub-actions so normal
// REST routes like /inventory/batches or /batches/bulk are never misread.
const SUB_ACTION_VERB: Record<string, string> = {
  approve:         'APPROVE',
  reject:          'REJECT',
  dispatch:        'DISPATCH',
  receive:         'RECEIVE',
  cancel:          'CANCEL',
  dispense:        'DISPENSE',
  verify:          'VERIFY',
  return:          'RETURN',
  activate:        'ACTIVATE',
  deactivate:      'DEACTIVATE',
  restore:         'RESTORE',
  complete:        'COMPLETE',
  'fix-received':  'FIX',
  'reset-password':'RESET_PASSWORD',
  download:        'DOWNLOAD',
};

// Reads are not audited — there would be a row for every page view. The one
// exception is a download, which for backups means the entire database
// leaving the server. That is at least as sensitive as any write.
const AUDITED_READ_SUFFIX = '/download';

// Human-readable past tense for building the audit description line.
const ACTION_PAST_TENSE: Record<string, string> = {
  CREATE:         'Created',
  UPDATE:         'Updated',
  DELETE:         'Deleted',
  APPROVE:        'Approved',
  REJECT:         'Rejected',
  DISPATCH:       'Dispatched',
  RECEIVE:        'Received',
  CANCEL:         'Cancelled',
  DISPENSE:       'Dispensed',
  VERIFY:         'Verified',
  RETURN:         'Returned',
  ACTIVATE:       'Activated',
  DEACTIVATE:     'Deactivated',
  RESTORE:        'Restored',
  COMPLETE:       'Completed',
  FIX:            'Fixed',
  RESET_PASSWORD: 'Reset password for',
  DOWNLOAD:       'Downloaded',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<UserRequest>();
    const { method, url, params, body } = request;
    const { user } = request;

    const isMutation = Object.keys(METHOD_ACTION).includes(method);
    const isAuditedRead =
      method === 'GET' && url.split('?')[0].endsWith(AUDITED_READ_SUFFIX);

    if ((!isMutation && !isAuditedRead) || !user?.sub) {
      return next.handle();
    }

    const requestBody = { ...body };

    return next.handle().pipe(
      tap((data) => {
        this.logOperation(request, user, method, url, params, requestBody, data, 'SUCCESS');
      }),
      catchError((error) => {
        this.logOperation(request, user, method, url, params, requestBody, null, 'FAILED', error.message);
        throw error;
      }),
    );
  }

  private async logOperation(
    request: UserRequest,
    user: any,
    method: string,
    url: string,
    params: any,
    requestBody: any,
    responseData: any,
    status: 'SUCCESS' | 'FAILED',
    errorMessage?: string,
  ) {
    try {
      const cleanUrl = url.split('?')[0];
      const pathParts = cleanUrl.split('/').filter(Boolean);
      const apiIdx = pathParts.findIndex((p) => p === 'v1');
      const resourceParts = apiIdx >= 0 ? pathParts.slice(apiIdx + 1) : pathParts;
      const resource = resourceParts[0] || '';

      const meta = ROUTE_META[resource] ?? {
        module: this.toTitleCase(resource),
        entity: this.toPascalCase(resource),
      };

      // Detect a custom action endpoint: the trailing path segment is a known
      // verb (e.g. /transfers/:id/dispatch → DISPATCH). Falls back to the plain
      // HTTP-method action for standard REST routes.
      const lastSegment = resourceParts[resourceParts.length - 1]?.toLowerCase();
      const subAction = lastSegment ? SUB_ACTION_VERB[lastSegment] : undefined;
      const baseAction = subAction ?? METHOD_ACTION[method];

      const action = status === 'FAILED'
        ? `${baseAction}_FAILED`
        : baseAction;

      // Not every entity is keyed by id — a backup is identified by its
      // filename, in the route for download/delete and in the body on create.
      const entityId =
        params?.id ||
        params?.filename ||
        responseData?.id ||
        responseData?.filename ||
        requestBody?.id ||
        'unknown';

      const description = this.buildDescription(
        action, meta.module, meta.entity, entityId, requestBody, responseData, errorMessage,
      );

      await this.auditService.log({
        userId: user.sub,
        hospitalId: user.hospitalId || 'unknown',
        action,
        module: meta.module,
        entityType: meta.entity,
        entityId,
        description,
        beforeState: method === 'DELETE' ? requestBody : undefined,
        afterState: status === 'SUCCESS' ? responseData : undefined,
      });
    } catch (err) {
      console.error('[AUDIT_INTERCEPTOR_ERROR]', err);
    }
  }

  private buildDescription(
    action: string, module: string, entity: string, entityId: string,
    body: any, response: any, errorMessage?: string,
  ): string {
    const name =
      response?.requestNumber || body?.requestNumber ||
      response?.name || body?.name ||
      response?.nrNumber || body?.nrNumber ||
      response?.email || body?.email ||
      response?.code || body?.code ||
      entityId;

    if (action.endsWith('_FAILED')) {
      const attempted = action.replace('_FAILED', '');
      const verb = (ACTION_PAST_TENSE[attempted] || attempted).toLowerCase();
      return `Failed to ${verb} ${entity.toLowerCase()} ${name} — ${errorMessage || 'unknown error'}`;
    }

    // A record entered under an earlier date is a different act from one
    // entered as it happens, and the log has to say so — otherwise the only
    // trace is a timestamp that disagrees with the entry it sits next to.
    const backDated = this.describeBackDating(body, response);

    // Prefer the readable past tense (covers CREATE/UPDATE/DELETE and every
    // custom verb like DISPATCH/APPROVE/RECEIVE); fall back gracefully.
    const pastTense = ACTION_PAST_TENSE[action];
    if (pastTense) {
      return action === 'CREATE'
        ? `Created new ${entity}: ${name}${backDated}`
        : `${pastTense} ${entity}: ${name}${backDated}`;
    }
    return `${action} on ${entity}: ${name}${backDated}`;
  }

  /**
   * Suffix naming the date a record was back-dated to, or '' when it was not.
   * Reads the request body so it holds for any resource that grows a
   * back-dating field, not just prescriptions.
   */
  private describeBackDating(body: any, response: any): string {
    const raw = body?.prescribedAt ?? body?.backDatedTo;
    if (!raw) return '';

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';

    const entered = response?.createdAt ? new Date(response.createdAt) : null;
    const shown = entered && !Number.isNaN(entered.getTime()) ? entered : date;

    const dd = String(shown.getDate()).padStart(2, '0');
    const mm = String(shown.getMonth() + 1).padStart(2, '0');
    return ` — back-dated to ${dd}/${mm}/${shown.getFullYear()}`;
  }

  private toPascalCase(str: string): string {
    return str.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  private toTitleCase(str: string): string {
    return str.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
