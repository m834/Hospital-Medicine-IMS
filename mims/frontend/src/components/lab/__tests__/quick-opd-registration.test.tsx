import * as React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickOpdRegistration } from '../quick-opd-registration';

const mockPost = jest.fn();
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: { post: (...args: any[]) => mockPost(...args) },
  getErrorMessage: (error: any) => error?.message,
}));

const desk = { role: 'REGISTRATION_STAFF' };
const patient = { id: 'patient-1', nrNumber: 'MRN-20261007-482913', fullName: 'Ali Khan' };

function setUp(user: { role: string } | null = desk, selectedHospitalId?: string) {
  const onRegistered = jest.fn();
  render(
    <QuickOpdRegistration
      user={user}
      selectedHospitalId={selectedHospitalId}
      onRegistered={onRegistered}
    />,
  );
  return { onRegistered };
}

const nameBox = () => screen.getByLabelText('New patient full name');
const saveButton = () => screen.getByRole('button', { name: /save/i });

describe('QuickOpdRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockResolvedValue({ data: patient });
  });

  it('registers an OPD patient by name, exactly as Patient Registration does', async () => {
    const { onRegistered } = setUp();

    fireEvent.change(nameBox(), { target: { value: '  Ali Khan  ' } });
    await act(async () => {
      fireEvent.click(saveButton());
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/patients',
      { fullName: 'Ali Khan', visitType: 'OPD' },
      { params: {} },
    );
    expect(onRegistered).toHaveBeenCalledWith(patient);
    expect(nameBox()).toHaveValue('');
  });

  it('sends the gender when one is picked, and clears it after saving', async () => {
    setUp();

    fireEvent.change(nameBox(), { target: { value: 'Ayesha Bibi' } });
    fireEvent.change(screen.getByLabelText('New patient gender'), { target: { value: 'FEMALE' } });
    await act(async () => {
      fireEvent.click(saveButton());
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/patients',
      { fullName: 'Ayesha Bibi', visitType: 'OPD', gender: 'FEMALE' },
      { params: {} },
    );
    expect(screen.getByLabelText('New patient gender')).toHaveValue('');
  });

  it('leaves gender optional: the name alone is enough', () => {
    setUp();

    expect(screen.getByLabelText('New patient gender')).toHaveValue('');
    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    expect(saveButton()).toBeEnabled();
  });

  it('saves on Enter from the gender box too', async () => {
    setUp();

    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    fireEvent.change(screen.getByLabelText('New patient gender'), { target: { value: 'MALE' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('New patient gender'), { key: 'Enter' });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0][1]).toMatchObject({ gender: 'MALE' });
  });

  it('hands the page its name box, so the cursor can start there', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<QuickOpdRegistration user={desk} onRegistered={jest.fn()} nameInputRef={ref} />);

    expect(ref.current).toBe(nameBox());
  });

  it('saves on Enter', async () => {
    setUp();

    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    await act(async () => {
      fireEvent.keyDown(nameBox(), { key: 'Enter' });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('registers one patient however many times Save is pressed', async () => {
    let finish!: (value: unknown) => void;
    mockPost.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    setUp();

    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    await act(async () => {
      fireEvent.click(saveButton());
      fireEvent.click(saveButton());
      fireEvent.keyDown(nameBox(), { key: 'Enter' });
    });

    expect(mockPost).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: patient }));
  });

  it('will not save a name shorter than two letters', async () => {
    setUp();

    fireEvent.change(nameBox(), { target: { value: ' A ' } });
    expect(saveButton()).toBeDisabled();

    await act(async () => {
      fireEvent.keyDown(nameBox(), { key: 'Enter' });
    });
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('shows the server error and keeps the name for another try', async () => {
    mockPost.mockRejectedValue(new Error('Hospital not found'));
    const { onRegistered } = setUp();

    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    await act(async () => {
      fireEvent.click(saveButton());
    });

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Hospital not found'));
    expect(onRegistered).not.toHaveBeenCalled();
    expect(nameBox()).toHaveValue('Ali Khan');
  });

  it('names the hospital for a super admin, as Patient Registration does', async () => {
    setUp({ role: 'SUPER_ADMIN' }, 'hospital-9');

    fireEvent.change(nameBox(), { target: { value: 'Ali Khan' } });
    await act(async () => {
      fireEvent.click(saveButton());
    });

    expect(mockPost).toHaveBeenCalledWith('/patients', expect.anything(), {
      params: { hospitalId: 'hospital-9' },
    });
  });

  it('is not shown to a role the server would refuse', () => {
    setUp({ role: 'LAB_TECHNICIAN' });

    expect(screen.queryByLabelText('New patient full name')).toBeNull();
  });
});
