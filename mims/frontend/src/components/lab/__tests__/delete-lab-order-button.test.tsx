import * as React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeleteLabOrderButton } from '../delete-lab-order-button';

const mockDelete = jest.fn();
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { delete: (...args: any[]) => mockDelete(...args) },
  getErrorMessage: (error: any) => error?.message,
}));

const order = {
  id: 'order-1',
  orderNumber: 'LAB-20261007-0001',
  labTest: { testName: 'Complete Blood Count' },
  patient: { fullName: 'Ali Khan' },
};

function setUp(role = 'SUPER_ADMIN') {
  const onDeleted = jest.fn();
  render(<DeleteLabOrderButton order={order} user={{ role }} onDeleted={onDeleted} />);
  return { onDeleted };
}

const openDialog = () => fireEvent.click(screen.getByRole('button', { name: 'Delete LAB-20261007-0001' }));
const confirmButton = () => screen.getByRole('button', { name: /^delete$/i });

describe('DeleteLabOrderButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockResolvedValue({ data: {} });
  });

  it('asks before deleting, naming the test and the patient', () => {
    setUp();
    openDialog();

    expect(screen.getByText('Delete this lab test?')).toBeInTheDocument();
    expect(screen.getByText(/LAB-20261007-0001 — Complete Blood Count for Ali Khan/)).toBeInTheDocument();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes only once the super admin confirms', async () => {
    const { onDeleted } = setUp();
    openDialog();

    await act(async () => {
      fireEvent.click(confirmButton());
    });

    expect(mockDelete).toHaveBeenCalledWith('/lab-orders/order-1');
    expect(onDeleted).toHaveBeenCalledWith(order);
  });

  it('deletes nothing when cancelled', () => {
    setUp();
    openDialog();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('shows the server refusal and keeps the dialog open', async () => {
    mockDelete.mockRejectedValue(new Error('Only a super admin can delete a lab test'));
    const { onDeleted } = setUp();
    openDialog();

    await act(async () => {
      fireEvent.click(confirmButton());
    });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Only a super admin can delete a lab test'),
    );
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it.each(['HOSPITAL_ADMIN', 'MASTER_ADMIN', 'REGISTRATION_STAFF_MANAGER'])(
    'is not shown to %s',
    (role) => {
      setUp(role);
      expect(screen.queryByRole('button', { name: /delete/i })).toBeNull();
    },
  );
});
