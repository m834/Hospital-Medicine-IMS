import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { SlipPrintNotice } from '../slip-print-notice';

describe('SlipPrintNotice', () => {
  it('shows the green "sent to the printer" notice when the print started', () => {
    render(<SlipPrintNotice printed orderNumbers={['LAB-1', 'LAB-2']} />);

    expect(screen.getByRole('status').textContent).toContain('2 slips sent to the printer');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says the slip did not print when the helper returned false', () => {
    render(<SlipPrintNotice printed={false} orderNumbers={['LAB-1']} />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Slip did not print — reprint from Test List');
    expect(alert.textContent).toContain('LAB-1');
    expect(alert.textContent).toContain('Retry Print');
  });

  it('never shows success on a failed print', () => {
    const { container } = render(<SlipPrintNotice printed={false} orderNumbers={['LAB-1']} />);

    expect(container.textContent).not.toContain('sent to the printer');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('flags a print that started but could not be recorded', () => {
    render(
      <SlipPrintNotice printed orderNumbers={['LAB-1']} recordError="network down" />,
    );

    expect(screen.getByRole('status').textContent).toContain(
      'The print could not be recorded on the server: network down',
    );
  });
});
