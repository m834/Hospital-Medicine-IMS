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
};

const METHOD_ACTION: Record<string, string> = {
  POST:   'CREATE',
  PUT:    'UPDATE',
  PATCH:  'UPDATE',
  DELETE: 'DELETE',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<UserRequest>();
    const { method, url, params, body } = request;
    const { user } = request;

    if (!Object.keys(METHOD_ACTION).includes(method) || !user?.sub) {
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

      const action = status === 'FAILED'
        ? `${METHOD_ACTION[method]}_FAILED`
        : METHOD_ACTION[method];

      const entityId = params?.id || responseData?.id || requestBody?.id || 'unknown';

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
      response?.name || body?.name ||
      response?.nrNumber || body?.nrNumber ||
      response?.email || body?.email ||
      response?.code || body?.code ||
      entityId;

    if (action.endsWith('_FAILED')) {
      return `Failed to ${action.replace('_FAILED', '').toLowerCase()} ${entity.toLowerCase()} — ${errorMessage || 'unknown error'}`;
    }
    switch (action) {
      case 'CREATE': return `Created new ${entity}: ${name}`;
      case 'UPDATE': return `Updated ${entity}: ${name}`;
      case 'DELETE': return `Deleted ${entity}: ${name}`;
      default:       return `${action} on ${entity}: ${name}`;
    }
  }

  private toPascalCase(str: string): string {
    return str.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  }

  private toTitleCase(str: string): string {
    return str.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
