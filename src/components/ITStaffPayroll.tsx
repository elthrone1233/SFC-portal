import React, { useEffect, useState } from 'react';
import { Coins, Clock, User, Edit, ShieldAlert, CheckCircle2, Calendar, ArrowLeft, AlertCircle, Save, Archive, ChevronDown, ChevronUp, Download, Printer } from 'lucide-react';
import { User as UserType, hasRole } from '../types';

interface ITStaffPayrollProps {
  currentUser: UserType;
}

export default function ITStaffPayroll({ currentUser }: ITStaffPayrollProps) {
  const [itStaff, setItStaff] = useState<any[]>([]);
  const [timecards, setTimecards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  
  // Date range filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Month & Year selector states for active calculations month selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Editing Rate states
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editRateValue, setEditRateValue] = useState<string>('');

  // New settlement state variables
  const [activeSegment, setActiveSegment] = useState<'calc' | 'archive'>('calc');
  const [settledLogs, setSettledLogs] = useState<any[]>([]);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [settleRemarks, setSettleRemarks] = useState('');
  const [isSettling, setIsSettling] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Master Admin role check & state variables
  const isMasterAdmin = !!(currentUser.email && ['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email.toLowerCase()));
  const canEditTime = isMasterAdmin || hasRole(currentUser, ['ADMIN', 'MANAGER', 'HR']);
  const [showEditTimeModal, setShowEditTimeModal] = useState(false);
  const [editingDate, setEditingDate] = useState('');
  const [editingTimeStr, setEditingTimeStr] = useState('');
  const [isUpdatingTime, setIsUpdatingTime] = useState(false);

  const convert12to24 = (time12h: string): string => {
    if (!time12h || time12h === '-') return '08:00';
    try {
      const parts = time12h.split(' ');
      const time = parts[0];
      const modifier = parts[1];
      let [hours, minutes] = time.split(':');
      if (hours === '12') {
        hours = '00';
      }
      if (modifier === 'PM' || modifier === 'pm') {
        hours = String(parseInt(hours, 10) + 12);
      }
      return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
    } catch {
      return '08:00';
    }
  };

  const handleSaveTime = async (timeVal: string) => {
    if (!activeStaffToCalculate) return;
    setIsUpdatingTime(true);
    try {
      const res = await fetch('/api/timecards/edit-time', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          targetEmail: activeStaffToCalculate.email,
          targetUserId: activeStaffToCalculate.id,
          dateStr: editingDate,
          timeStr: timeVal
        })
      });
      if (res.ok) {
        await fetchData();
        setShowEditTimeModal(false);
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update time log');
      }
    } catch (err) {
      console.error('Error updating timecard:', err);
      alert('Error updating timecard record');
    } finally {
      setIsUpdatingTime(false);
    }
  };

  // Update dateFrom and dateTo based on Month/Year Selection
  useEffect(() => {
    const year = selectedYear;
    const month = String(selectedMonth + 1).padStart(2, '0');
    
    // First day of selected month
    setDateFrom(`${year}-${month}-01`);
    
    // Last day of selected month
    const lastDayVal = new Date(year, selectedMonth + 1, 0).getDate();
    setDateTo(`${year}-${month}-${String(lastDayVal).padStart(2, '0')}`);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchSettledLogs = async () => {
    try {
      const res = await fetch('/api/it-payroll/settled', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setSettledLogs(data);
      }
    } catch (err) {
      console.error('Error fetching settled logs:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch users to filter IT role
      const resUsers = await fetch('/api/accounts', {
        headers: { 'x-user-email': currentUser.email }
      });
      const allUsers = await resUsers.json();
      const filteredIT = allUsers.filter((u: any) => hasRole(u, 'IT'));
      setItStaff(filteredIT);

      // Fetch all clock-in timecards
      const resCards = await fetch('/api/timecards', {
        headers: { 'x-user-email': currentUser.email }
      });
      const allCards = await resCards.json();
      setTimecards(allCards);

      // Fetch historic logs
      await fetchSettledLogs();
    } catch (err) {
      console.error('Error fetching payroll data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRate = async (staffId: string) => {
    const parsed = parseFloat(editRateValue);
    if (isNaN(parsed) || parsed <= 0) {
      setNotification({ message: 'Please enter a valid rate amount.', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/accounts/update-rate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ userId: staffId, dailyRate: parsed })
      });

      const rawText = await res.text();
      let isJson = false;
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(rawText);
        isJson = true;
      } catch (parseErr) {
        // Handled below
      }

      const isHtmlResponse = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      if (!isJson || isHtmlResponse) {
        console.error('Non-JSON/HTML error response raw text for debugging during daily rate update:', rawText);
      }

      if (res.ok) {
        setNotification({ message: 'Daily base rate updated successfully!', type: 'success' });
        setEditingStaffId(null);
        fetchData();
        
        // If the selected staff's rate was changed, update it in selected staff too
        if (selectedStaff && selectedStaff.id === staffId) {
          setSelectedStaff((prev: any) => ({ ...prev, dailyRate: parsed }));
        }
      } else {
        let errorMsg = 'Failed to update rate.';
        if (isJson && parsedData && parsedData.error) {
          errorMsg = parsedData.error;
        } else {
          // Fallback display if server returns HTML error pages: strip tags and truncate
          const cleanText = rawText.replace(/<\/?[^>]+(>|$)/g, " ").trim();
          const truncated = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
          errorMsg = truncated ? `Server Error: ${truncated}` : `Server returned status code ${res.status}.`;
        }
        setNotification({ message: errorMsg, type: 'error' });
      }
    } catch (err: any) {
      console.error('Connection catch block error during daily rate update:', err);
      setNotification({ message: err.message || 'An error occurred.', type: 'error' });
    }
  };

  const handleExportSettleLogs = (list: any[]) => {
    if (list.length === 0) return;
    const header = 'Settlement ID,IT Staff Name,Email,Period,Daily Rate,Days Present,Days Absent,Deductions,Paid Amount,Paid Date,Settled By,Remarks\n';
    const rows = list.map(item => 
      `"${item.id || ''}","${item.userName || ''}","${item.userEmail || ''}","${item.dateRange || ''}",${item.dailyRate || 440},${item.daysPresent || 0},${item.daysAbsent || 0},${item.totalDeductions || 0},${item.totalEarned || 0},"${item.paidDate || ''}","${item.settledBy || ''}","${(item.remarks || '').replace(/"/g, '""')}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SFC_IT_Settled_Payroll_Logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPayroll = (
    staffName: string,
    staffEmail: string,
    range: string,
    dailyRate: number,
    daysPresent: number,
    daysAbsent: number,
    totalLateMinutes: number,
    totalDeductions: number,
    totalEarned: number,
    breakdownList: any[],
    settledBy?: string,
    paidDate?: string
  ) => {
    const iframeId = 'print-payslip-iframe';
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;
    if (iframe) {
      document.body.removeChild(iframe);
    }
    iframe = document.createElement('iframe');
    iframe.id = iframeId;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const breakdownHtml = (breakdownList || []).map(row => {
      const formattedDate = new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `
        <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <td style="padding: 8px; font-weight: bold; font-family: monospace;">${formattedDate}</td>
          <td style="padding: 8px;">${row.status || 'Present'}</td>
          <td style="padding: 8px; font-family: monospace;">${row.clockIn || '---'}</td>
          <td style="padding: 8px; font-family: monospace; text-align: right;">${row.lateMinutes > 0 ? `${row.lateMinutes} mins` : '-'}</td>
          <td style="padding: 8px; font-family: monospace; text-align: right; color: #dc2626;">${row.deduction > 0 ? `-₱${row.deduction}` : '-'}</td>
          <td style="padding: 8px; font-family: monospace; text-align: right; font-weight: bold; color: #1e3a8a;">₱${row.earned}</td>
        </tr>
      `;
    }).join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>IT Official Payslip - ${staffName}</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #334155; margin: 40px; padding: 0; }
            .header { border-bottom: 3px double #cbd5e1; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 16px; font-weight: bold; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; }
            .sub-logo { font-size: 10px; color: #64748b; margin-top: 2px; }
            .title { text-align: right; }
            .title h1 { font-size: 18px; margin: 0; color: #1e3a8a; text-transform: uppercase; }
            .title p { font-size: 10px; color: #64748b; margin: 4px 0 0 0; }
            
            .meta-grid { display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 11px; line-height: 1.6; }
            .meta p { margin: 4px 0; }
            .meta strong { color: #0f172a; }

            .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 11px; }
            .summary-table th { background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; padding: 10px 8px; text-align: left; text-transform: uppercase; color: #475569; font-weight: bold; }
            .summary-table td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; }

            .amount-summary { font-size: 11px; margin-left: auto; width: 320px; border-top: 2px solid #475569; margin-top: 20px; padding-top: 10px; }
            .amount-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .amount-row.total { font-size: 13px; font-weight: bold; color: #047857; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 8px; }

            .breakdown-section { margin-top: 40px; page-break-before: auto; }
            .breakdown-section h2 { font-size: 12px; margin-bottom: 10px; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; }
            .details-table { width: 100%; border-collapse: collapse; font-size: 11px; }
            .details-table th { background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 8px; text-align: left; color: #475569; font-weight: bold; }
            
            .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 11px; }
            .signature-box { border-top: 1px solid #94a3b8; width: 220px; text-align: center; padding-top: 8px; margin-top: 50px; }
            
            .footer { margin-top: 65px; border-top: 1px solid #e2e8f0; padding-top: 10px; text-align: center; font-size: 9px; color: #94a3b8; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">Saint Francis Clinic</div>
              <div class="sub-logo">Operational IT Personnel Administration Services</div>
            </div>
            <div class="title">
              <h1>Official Payslip</h1>
              <p>Reference: ${range}</p>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; margin-bottom: 25px; font-size: 11px;">
            <div class="meta">
              <p><strong>Employee Name:</strong> ${staffName}</p>
              <p><strong>Email Address:</strong> ${staffEmail}</p>
              <p><strong>Department Role:</strong> IT Specialist</p>
            </div>
            <div class="meta" style="text-align: right;">
              <p><strong>Pay Cycle Period:</strong> ${range}</p>
              <p><strong>Base Rate Charge:</strong> ₱${dailyRate.toLocaleString()} / Shift Day</p>
              ${paidDate ? `<p><strong>Disbursed on:</strong> ${paidDate}</p>` : `<p><strong>Billing Status:</strong> Active Calculations Statement</p>`}
              ${settledBy ? `<p><strong>Settle Official:</strong> ${settledBy}</p>` : ''}
            </div>
          </div>

          <table class="summary-table">
            <thead>
              <tr>
                <th>Calculation Breakdown Metric</th>
                <th style="text-align: right;">Value / Days</th>
                <th style="text-align: right;">Base Charge</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Scheduled Working Days Present</td>
                <td style="text-align: right;">${daysPresent} Days</td>
                <td style="text-align: right;">₱${dailyRate.toLocaleString()}</td>
                <td style="text-align: right;">₱${(daysPresent * dailyRate).toLocaleString()}</td>
              </tr>
              <tr>
                <td>Lateness Deductions Incidental (Accumulated: ${totalLateMinutes} mins)</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right;">-</td>
                <td style="text-align: right; color: #dc2626;">-₱${totalDeductions.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Days Absent Non-justified Status</td>
                <td style="text-align: right;">${daysAbsent} Days Absent</td>
                <td style="text-align: right;">₱${dailyRate.toLocaleString()}</td>
                <td style="text-align: right; color: #94a3b8;">-₱0.00 (Unearned Shift)</td>
              </tr>
            </tbody>
          </table>

          <div class="amount-summary">
            <div class="amount-row">
              <span>Gross Pro-rata Salary:</span>
              <strong style="font-family: monospace;">₱${(daysPresent * dailyRate).toLocaleString()}</strong>
            </div>
            <div class="amount-row">
              <span style="color: #dc2626;">Total Late Penalty Deductions:</span>
              <strong style="color: #dc2626; font-family: monospace;">-₱${totalDeductions.toLocaleString()}</strong>
            </div>
            <div class="amount-row total">
              <span>NET SALARY DISBURSABLE:</span>
              <strong style="font-size: 15px; font-family: monospace; color: #047857;">₱${totalEarned.toLocaleString()}</strong>
            </div>
          </div>

          <div class="breakdown-section">
            <h2>Detailed Daily Punch Entry Logs Trail</h2>
            <table class="details-table">
              <thead>
                <tr style="border-bottom: 2px solid #cbd5e1; font-weight: bold;">
                  <th style="padding: 8px;">Scheduled Date</th>
                  <th style="padding: 8px;">Punch Status</th>
                  <th style="padding: 8px;">Timestamp IN</th>
                  <th style="padding: 8px; text-align: right;">Lateness</th>
                  <th style="padding: 8px; text-align: right;">Deduction</th>
                  <th style="padding: 8px; text-align: right;">Earning</th>
                </tr>
              </thead>
              <tbody>
                ${breakdownHtml}
              </tbody>
            </table>
          </div>

          <div class="signatures">
            <div>
              <div class="signature-box" style="margin-top: 40px;">
                <strong>${staffName}</strong><br>
                <span style="color: #64748b; font-size: 10px;">IT Officer Sign-off & Acknowledgement</span>
              </div>
            </div>
            <div>
              <div class="signature-box" style="margin-top: 40px;">
                <strong>${settledBy || 'Authorized Officer'}</strong><br>
                <span style="color: #64748b; font-size: 10px;">Authorized Signature / Cashier</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Saint Francis Clinic Medical Dental & Multi-specialty Clinic Services Inc.</p>
            <p>This document constitutes an official record of digital timesheet ledger and salary payout. Confidentiality strictly governed.</p>
          </div>
        </body>
      </html>
    `;

    doc.open();
    doc.write(htmlContent);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 450);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStaffToCalculate || !calculations) return;

    setIsSettling(true);
    try {
      const res = await fetch('/api/it-payroll/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          userId: activeStaffToCalculate.id,
          dateFrom,
          dateTo,
          dailyRate: calculations.summary.dailyRate,
          totalEarned: calculations.summary.totalEarned,
          totalDeductions: calculations.summary.totalDeductions,
          daysPresent: calculations.summary.daysPresent,
          daysAbsent: calculations.summary.daysAbsent,
          totalLateMinutes: calculations.summary.totalLateMinutes,
          breakdown: calculations.breakdown,
          remarks: settleRemarks
        })
      });

      // Strict text parsing first to handle non-JSON or HTML/error responses safely
      const rawText = await res.text();
      let isJson = false;
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(rawText);
        isJson = true;
      } catch (parseErr) {
        // Handled below
      }

      const isHtmlResponse = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      if (!isJson || isHtmlResponse) {
        console.error('Non-JSON/HTML error response raw text for debugging:', rawText);
      }

      if (res.ok) {
        setNotification({
          message: `Successfully settled and paid ₱${calculations.summary.totalEarned.toLocaleString()} to ${activeStaffToCalculate.fullName} for period ${dateFrom} to ${dateTo}!`,
          type: 'success'
        });
        setSettleRemarks('');
        setShowSettleModal(false);
        // Refresh timesheets and logs
        await fetchData();
      } else {
        let errorMsg = 'Failed to settle payroll.';
        if (isJson && parsedData && parsedData.error) {
          errorMsg = parsedData.error;
        } else {
          // Fallback display if server returns HTML error pages: strip tags and truncate
          const cleanText = rawText.replace(/<\/?[^>]+(>|$)/g, " ").trim();
          const truncated = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
          errorMsg = truncated ? `Server Error: ${truncated}` : `Server returned status code ${res.status}.`;
        }

        setNotification({
          message: errorMsg,
          type: 'error'
        });
      }
    } catch (err: any) {
      console.error('Connection catch block error during IT settlement:', err);
      setNotification({
        message: err.message || 'Error occurred during payroll settlement.',
        type: 'error'
      });
    } finally {
      setIsSettling(false);
    }
  };

  const handleClearAttendance = async () => {
    if (!activeStaffToCalculate) {
      setNotification({ message: 'No staff member selected.', type: 'error' });
      return;
    }
    setIsClearing(true);
    try {
      const res = await fetch('/api/timecards/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          userId: activeStaffToCalculate.id,
          userEmail: activeStaffToCalculate.email,
          dateFrom,
          dateTo
        })
      });

      if (res.ok) {
        const result = await res.json();
        setNotification({
          message: result.message || 'Successfully cleared attendance logs for this period.',
          type: 'success'
        });
        setShowClearConfirmModal(false);
        await fetchData();
      } else {
        const errData = await res.json();
        setNotification({
          message: errData.error || 'Failed to clear attendance.',
          type: 'error'
        });
      }
    } catch (err: any) {
      console.error('Error clearing attendance:', err);
      setNotification({
        message: 'Network error or unable to contact server while clearing attendance.',
        type: 'error'
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Helper: Format ISO timestamp to local Philippine Time HH:MM AM/PM
  const formatLocalTime = (isoString: string) => {
    const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
    let hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = String(minutes).padStart(2, '0');
    return `${hours}:${minutesStr} ${ampm}`;
  };

  // Helper to parse dates to local YYYY-MM-DD for list comparison
  const getLocalDateString = (isoString: string) => {
    const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Build the list of active dates in date range
  const getDatesInRange = (startStr: string, endStr: string) => {
    const dates: string[] = [];
    if (!startStr || !endStr) return dates;
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    const current = new Date(start);

    // Limit to prevent browser lockup
    let maxDays = 120;
    while (current <= end && maxDays > 0) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
      maxDays--;
    }
    return dates;
  };

  // Main Late clock-in and deduction logic
  const calculateDailyPayrollDetails = (staffMember: any) => {
    const activeDailyRate = staffMember.dailyRate !== undefined ? staffMember.dailyRate : 440;
    const datesList = getDatesInRange(dateFrom, dateTo);
    
    // 1. Check if there is an existing settled log for this user covering this date range exactly
    const matchingSettledLog = settledLogs.find(log => {
      const isUserMatch = (log.userId && log.userId === staffMember.id) ||
                          (!log.userId && log.userEmail && staffMember.email && log.userEmail.toLowerCase() === staffMember.email.toLowerCase());
      const rangeMatch = log.dateRange === `${dateFrom} to ${dateTo}`;
      return isUserMatch && rangeMatch;
    });

    if (matchingSettledLog) {
      // Settled officers should display only their archived attendance records.
      return {
        breakdown: matchingSettledLog.breakdown || [],
        isAlreadySettled: true,
        summary: {
          dailyRate: matchingSettledLog.dailyRate || activeDailyRate,
          daysPresent: matchingSettledLog.daysPresent || 0,
          daysAbsent: matchingSettledLog.daysAbsent || 0,
          totalLateMinutes: matchingSettledLog.totalLateMinutes || 0,
          totalDeductions: matchingSettledLog.totalDeductions || 0,
          totalEarned: matchingSettledLog.totalEarned || 0,
          totalDays: datesList.length,
          totalOvertimeHours: matchingSettledLog.totalOvertimeHours || 0,
          totalOvertimePay: matchingSettledLog.totalOvertimePay || 0
        }
      };
    }

    // Filter timecards strictly for this current staff member (exclude settled records and prevent cross-user leakage)
    const staffCards = timecards.filter(tc => {
      const isSelf = (tc.userId && tc.userId === staffMember.id) || 
                     (!tc.userId && tc.userEmail && staffMember.email && tc.userEmail.toLowerCase() === staffMember.email.toLowerCase());
      return isSelf && !tc.settled;
    });

    let totalEarned = 0;
    let totalDeductions = 0;
    let daysPresent = 0;
    let totalLateMinutes = 0;
    let totalOvertimeHours = 0;
    let totalOvertimePay = 0;

    const breakdown = datesList.map(dateStr => {
      // Find all regular and overtime check-ins/outs on this date
      const regularIns = staffCards.filter(tc => tc.type === 'IN' && !tc.isOvertime && getLocalDateString(tc.timestamp) === dateStr);
      
      // Calculate Overtime Shift details
      const dayOTOuts = staffCards.filter(tc => tc.type === 'OUT' && tc.isOvertime && getLocalDateString(tc.timestamp) === dateStr);
      const dayOTHours = dayOTOuts.reduce((sum, tc) => sum + (tc.otHours || 0), 0);
      const overtimeRate = (activeDailyRate / 8) * 1.5;
      const overtimePay = Number((dayOTHours * overtimeRate).toFixed(2));

      totalOvertimeHours += dayOTHours;
      totalOvertimePay += overtimePay;

      if (regularIns.length === 0) {
        const todayStr = getLocalDateString(new Date().toISOString());
        const isFuture = dateStr > todayStr;
        const status = isFuture ? 'Future' : 'Absent';
        
        let dayEarned = overtimePay;
        totalEarned += dayEarned;

        return {
          date: dateStr,
          status: status,
          clockIn: '-',
          lateMinutes: 0,
          deduction: 0,
          earned: dayEarned,
          overtimeHours: dayOTHours,
          overtimePay: overtimePay
        };
      }

      // Earliest check-in of the day
      regularIns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const firstIn = regularIns[0];
      const d = new Date(new Date(firstIn.timestamp).getTime() + 8 * 60 * 60 * 1000);
      const hours = d.getUTCHours();
      const minutes = d.getUTCMinutes();
      const timeInMins = hours * 60 + minutes;

      // Duties start at 8:00 AM (480 mins) to 5:00 PM (1020 mins) with 1hr break (12nn to 1pm, 720 to 780 mins)
      let lateMinutes = 0;

      if (timeInMins <= 480) {
        lateMinutes = 0;
      } else if (timeInMins > 480 && timeInMins <= 720) {
        lateMinutes = timeInMins - 480;
      } else if (timeInMins > 720 && timeInMins < 780) {
        lateMinutes = 240;
      } else if (timeInMins >= 780 && timeInMins < 1020) {
        lateMinutes = (timeInMins - 480) - 60;
      } else {
        lateMinutes = 480;
      }

      // Strictly start deduction past 8:15 AM (8:00 AM - 8:15 AM inclusive is not late)
      if (lateMinutes <= 15) {
        lateMinutes = 0;
      }

      const activeDutyMinsInDay = 8 * 60; // 480 working minutes
      const deductionPct = lateMinutes / activeDutyMinsInDay;
      const deduction = Number((deductionPct * activeDailyRate).toFixed(2));
      const regularEarned = Number(Math.max(0, activeDailyRate - deduction).toFixed(2));
      const dayEarned = Number((regularEarned + overtimePay).toFixed(2));

      totalEarned += dayEarned;
      totalDeductions += deduction;
      daysPresent++;
      totalLateMinutes += lateMinutes;

      return {
        date: dateStr,
        status: lateMinutes > 0 ? 'Late' : 'Present',
        clockIn: formatLocalTime(firstIn.timestamp),
        lateMinutes,
        deduction,
        earned: dayEarned,
        overtimeHours: dayOTHours,
        overtimePay: overtimePay
      };
    });

    const daysAbsent = breakdown.filter(item => item.status === 'Absent').length;

    return {
      breakdown,
      summary: {
        dailyRate: activeDailyRate,
        daysPresent,
        daysAbsent,
        totalLateMinutes,
        totalDeductions,
        totalEarned: Number(totalEarned.toFixed(2)),
        totalDays: datesList.length,
        totalOvertimeHours: Number(totalOvertimeHours.toFixed(2)),
        totalOvertimePay: Number(totalOvertimePay.toFixed(2))
      }
    };
  };

  // Determine which view to render
  const isItUserOnly = hasRole(currentUser, 'IT') && !hasRole(currentUser, ['ADMIN', 'MANAGER', 'HR']) && !['elthrone1233@gmail.com', 'saintfrancisclinic2026@gmail.com'].includes(currentUser.email);

  // If simple IT user logged in, default target is themselves
  useEffect(() => {
    if (isItUserOnly && itStaff.length > 0) {
      const self = itStaff.find(u => u.email === currentUser.email || u.id === currentUser.id);
      if (self) setSelectedStaff(self);
    }
  }, [itStaff, isItUserOnly]);

  const activeStaffToCalculate = selectedStaff || (isItUserOnly ? itStaff.find(u => u.email === currentUser.email) : null);
  const calculations = activeStaffToCalculate ? calculateDailyPayrollDetails(activeStaffToCalculate) : null;

  // Helper to group breakdown list into monthly calendars
  const getMonthlyCalendars = (breakdown: any[]) => {
    if (!breakdown || breakdown.length === 0) return [];
    
    // Group dates by Year-Month
    const groups: { [key: string]: any[] } = {};
    breakdown.forEach(row => {
      const dateParts = row.date.split('-');
      if (dateParts.length === 3) {
        const yearMonth = `${dateParts[0]}-${dateParts[1]}`;
        if (!groups[yearMonth]) {
          groups[yearMonth] = [];
        }
        groups[yearMonth].push(row);
      }
    });

    const months = Object.keys(groups).sort();
    
    return months.map(yearMonth => {
      const [yearStr, monthStr] = yearMonth.split('-');
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      
      const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 is Sunday
      const totalDays = new Date(year, month, 0).getDate();
      
      const cells: any[] = [];
      
      // Leading empty/padding cells for first week
      for (let i = 0; i < firstDayIndex; i++) {
        cells.push({ isDummy: true });
      }
      
      // Full list of days
      for (let day = 1; day <= totalDays; day++) {
        const dStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const matchedRow = breakdown.find(r => r.date === dStr);
        cells.push({
          dateStr: dStr,
          day,
          isInRange: !!matchedRow,
          breakdownRow: matchedRow,
          isDummy: false
        });
      }
      
      // Trailing empty/padding cells to complete the last week
      while (cells.length % 7 !== 0) {
        cells.push({ isDummy: true });
      }
      
      // Format month label (e.g. "June 2026")
      const monthName = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      
      return {
        monthName,
        cells,
        yearMonth
      };
    });
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      
      {/* Header Banner */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <Coins className="h-5 w-5 text-blue-600" />
            IT Operational Personnel Payroll Ledger
          </h2>
          <p className="text-slate-400 text-[10px] mt-1">
            Dynamic payroll, 8 hrs shift, base of ₱{activeStaffToCalculate?.dailyRate !== undefined ? activeStaffToCalculate.dailyRate : 440}/day, shift 8:00 AM - 5:00 PM (12 PM - 1 PM rest)
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Segment Selector Tabs */}
          <div className="flex border border-slate-200 bg-slate-50 rounded-lg p-0.5">
            <button
              onClick={() => setActiveSegment('calc')}
              className={`text-center px-3 py-1 font-semibold font-sans transition rounded-md text-[10.5px] ${
                activeSegment === 'calc' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active Calculator
            </button>
            <button
              onClick={() => setActiveSegment('archive')}
              className={`text-center px-3 py-1 font-semibold font-sans transition rounded-md text-[10.5px] ${
                activeSegment === 'archive' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Settled Logs ({settledLogs.length})
            </button>
          </div>

          {/* Month selector (only show when calc segment is active) */}
          {activeSegment === 'calc' && (
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-xl">
              <Calendar className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-transparent border-0 p-1 text-[11px] font-bold text-slate-705 focus:outline-none cursor-pointer"
              >
                {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((mStr, idx) => (
                  <option key={idx} value={idx}>{mStr}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-transparent border-0 p-1 text-[11px] font-bold text-slate-705 focus:outline-none cursor-pointer"
              >
                {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(yr => (
                  <option key={yr} value={yr}>{yr}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {notification && (
        <div className={`p-3 rounded-xl border flex items-center justify-between ${
          notification.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{notification.type === 'success' ? '🟢' : '🔴'}</span>
            <span className="font-bold">{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-650 font-bold">✕</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
          <p className="text-slate-400 text-[10px] mt-2 font-bold animate-pulse">Syncing IT timesheet variables...</p>
        </div>
      ) : activeSegment === 'calc' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left panel: List of IT Staff (Only for Admins/Managers) */}
          {!isItUserOnly && (
            <div className="lg:col-span-4 bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <h3 className="font-bold text-slate-800 text-xs border-b pb-2 flex items-center gap-1.5">
                <User className="h-4 w-4 text-emerald-600" />
                Select IT Officer
              </h3>

              <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                {itStaff.map((staff) => {
                  const staffRate = staff.dailyRate !== undefined ? staff.dailyRate : 440;
                  const isSelected = selectedStaff?.id === staff.id;
                  
                  return (
                    <div 
                      key={staff.id}
                      className={`p-3 rounded-xl border cursor-pointer transition select-none flex flex-col justify-between gap-2 ${
                        isSelected 
                          ? 'bg-blue-50/50 border-blue-400/60 shadow-xs' 
                          : 'bg-white hover:bg-slate-50 border-slate-100'
                      }`}
                      onClick={() => setSelectedStaff(staff)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {staff.profilePicture ? (
                          <img 
                            src={staff.profilePicture} 
                            className="h-8 w-8 rounded-full object-cover border" 
                            alt="" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {staff.fullName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="truncate min-w-0">
                          <h4 className="font-bold text-slate-800 text-[11px] truncate leading-tight">{staff.fullName}</h4>
                          <p className="text-[9px] text-slate-400 truncate mt-0.5">{staff.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100/60 pt-2 text-[10px]">
                        <span className="text-slate-400 font-medium">Daily Standard Base:</span>
                        
                        {editingStaffId === staff.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-slate-600 font-bold">₱</span>
                            <input
                              type="number"
                              value={editRateValue}
                              onChange={(e) => setEditRateValue(e.target.value)}
                              className="w-16 p-1 py-0.5 text-xs font-mono font-bold border rounded bg-white text-slate-800"
                              placeholder="440"
                              autoFocus
                            />
                            <button
                              onClick={() => handleUpdateRate(staff.id)}
                              className="bg-emerald-500 hover:bg-emerald-650 text-white rounded p-1 font-bold"
                              title="Save Rate"
                            >
                              <Save className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditingStaffId(null)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-600 rounded p-1 font-bold text-[9px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <span className="font-mono text-blue-700">₱{staffRate}</span>
                            {hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingStaffId(staff.id);
                                  setEditRateValue(String(staffRate));
                                }}
                                className="text-slate-400 hover:text-blue-600 transition p-0.5 rounded hover:bg-slate-100/80"
                                title="Edit Rate Per Day"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {itStaff.length === 0 && (
                  <div className="text-center py-8 text-slate-400 font-bold">
                    No active personnel with role 'IT' registered in system database.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right panel: Details Sheet */}
          <div className={isItUserOnly ? 'lg:col-span-12' : 'lg:col-span-8'}>
            
            {activeStaffToCalculate ? (
              <div className="space-y-4">
                
                {/* Visual Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                  
                  {/* Card 1: Daily Base Rate */}
                  <div className="space-y-1">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Day Base Rate</span>
                    <div className="flex items-center gap-1">
                      <strong className="text-slate-800 text-base font-mono font-black">
                        ₱{calculations?.summary.dailyRate}
                      </strong>
                      
                      {isItUserOnly && (
                        <span className="text-[9px] text-amber-600 bg-amber-50 rounded px-1 font-bold">STANDARD</span>
                      )}

                      {!isItUserOnly && hasRole(currentUser, ['ADMIN', 'MANAGER']) && (
                        <button
                          onClick={() => {
                            setEditingStaffId(activeStaffToCalculate.id);
                            setEditRateValue(String(calculations?.summary.dailyRate || 440));
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-50 rounded transition"
                          title="Edit Daily Rate Amount"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    
                    {editingStaffId === activeStaffToCalculate.id && (
                      <div className="flex items-center gap-1 mt-1 bg-slate-50 p-1.5 rounded border border-blue-100">
                        <input
                          type="number"
                          value={editRateValue}
                          onChange={(e) => setEditRateValue(e.target.value)}
                          className="w-16 p-1 text-[10px] font-mono border rounded font-bold"
                          placeholder="440"
                        />
                        <button
                          onClick={() => handleUpdateRate(activeStaffToCalculate.id)}
                          className="bg-blue-600 text-white rounded p-1 text-[8px] font-bold uppercase"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingStaffId(null)}
                          className="text-slate-400 px-1 font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                    <span className="text-[9px] text-slate-400 block">Pro-rata: ₱{((calculations?.summary.dailyRate || 440) / 8).toFixed(2)}/hour</span>
                  </div>

                  {/* Card 2: Attendance statistics */}
                  <div className="space-y-1 border-l pl-3 border-slate-100">
                    <span className="text-slate-400 block text-[9px] font-bold uppercase tracking-wider">Present/Absent</span>
                    <strong className="text-slate-800 text-sm font-bold block mt-1">
                      <span className="text-emerald-600">{calculations?.summary.daysPresent} present</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="text-slate-400">{calculations?.summary.daysAbsent} absent</span>
                    </strong>
                    <span className="text-[9px] text-slate-400 block">Out of {calculations?.summary.totalDays} working days</span>
                  </div>

                  {/* Card 3: Late Penalties */}
                  <div className="space-y-1 border-l pl-3 border-slate-100">
                    <span className="text-slate-450 block text-[9px] font-bold uppercase tracking-wider text-rose-600">Late Deductions</span>
                    <strong className="text-rose-600 text-base font-mono font-bold block mt-0.5">
                      -₱{calculations?.summary.totalDeductions.toLocaleString()}
                    </strong>
                    <span className="text-[9px] text-slate-400 block">Elapsed late minutes: {calculations?.summary.totalLateMinutes} mins</span>
                  </div>

                  {/* Card 3.5: Overtime Pay */}
                  <div className="space-y-1 border-l pl-3 border-slate-100">
                    <span className="text-indigo-605 block text-[9px] font-bold uppercase tracking-wider text-indigo-600">Overtime Pay</span>
                    <strong className="text-indigo-600 text-base font-mono font-bold block mt-0.5">
                      +₱{calculations?.summary.totalOvertimePay.toLocaleString()}
                    </strong>
                    <span className="text-[9px] text-slate-400 block">OT Completed: {calculations?.summary.totalOvertimeHours} hrs</span>
                  </div>

                  {/* Card 4: Net Pay Disbursable */}
                  <div className="space-y-1 border-l pl-3 border-slate-100 bg-gradient-to-r from-emerald-50/20 to-indigo-50/10 rounded-r-xl">
                    <span className="text-emerald-700 block text-[9px] font-black uppercase tracking-wider">Disbursable payout</span>
                    <strong className="text-emerald-700 text-base font-mono font-black block mt-0.5">
                      ₱{calculations?.summary.totalEarned.toLocaleString()}
                    </strong>
                    <span className="text-[9px] text-slate-400 block font-semibold">Base Salary + Overtime</span>
                  </div>

                </div>

                {/* Timesheet Checklist table / calendar */}
                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden space-y-3 pb-4">
                  <div className="p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div>
                      <h3 className="font-bold text-slate-800 text-xs">
                        Timesheet & Deduction Ledger for {activeStaffToCalculate.fullName}
                      </h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Review checklist of clock-in events to substantiate late deductions.</p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {canEditTime && activeStaffToCalculate && (
                        <button
                          type="button"
                          onClick={() => setShowClearConfirmModal(true)}
                          className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-[10.5px] transition shadow-xs cursor-pointer"
                          title="Clear Calendar Attendance logs for this date range"
                        >
                          <AlertCircle className="h-3.5 w-3.5 text-rose-500" /> Clear Attendance
                        </button>
                      )}

                      {calculations && (calculations as any).isAlreadySettled ? (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] py-1.5 px-3 rounded-lg flex items-center gap-1 font-bold select-none">
                          <span>Already Settled ✅</span>
                        </div>
                      ) : (
                        hasRole(currentUser, ['ADMIN', 'MANAGER', 'HR']) && calculations && calculations.summary.daysPresent > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSettleRemarks(`Weekly payment settled for ${activeStaffToCalculate.fullName}`);
                              setShowSettleModal(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 text-[10.5px] transition shadow-xs cursor-pointer"
                            title="Settle payroll ledger for this period"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Settled Payroll
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="px-4 space-y-6">
                      {getMonthlyCalendars(calculations?.breakdown || []).map((monthObj) => (
                        <div key={monthObj.yearMonth} className="space-y-3 bg-slate-50/40 p-4 rounded-xl border border-slate-100">
                          <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                            <span className="font-extrabold text-slate-800 text-xs sm:text-sm uppercase tracking-wider">{monthObj.monthName}</span>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Present
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-amber-500"></span> Late
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-2 w-2 rounded-full bg-rose-500"></span> Absent
                              </span>
                            </div>
                          </div>

                          {/* Grid headers */}
                          <div className="grid grid-cols-7 gap-1 text-center font-bold text-slate-400 text-xs uppercase tracking-wider">
                            <div>Sun</div>
                            <div>Mon</div>
                            <div>Tue</div>
                            <div>Wed</div>
                            <div>Thu</div>
                            <div>Fri</div>
                            <div>Sat</div>
                          </div>

                          {/* Grid days */}
                          <div className="grid grid-cols-7 gap-2">
                            {monthObj.cells.map((cell: any, idx: number) => {
                              if (cell.isDummy) {
                                return (
                                  <div
                                    key={`dummy-${idx}`}
                                    className="aspect-square bg-slate-50/10 rounded-lg border border-slate-100/40 opacity-20"
                                  />
                                );
                              }

                              if (!cell.isInRange) {
                                return (
                                  <div
                                    key={cell.dateStr}
                                    className="aspect-square bg-slate-105 text-slate-400 rounded-lg border border-dashed border-slate-205 flex items-center justify-center font-semibold text-xs select-none"
                                    title="Outside of range"
                                  >
                                    {cell.day}
                                  </div>
                                );
                              }

                              const row = cell.breakdownRow;
                              let borderClass = 'border-slate-100';
                              let bgClass = 'bg-white';
                              let textClass = 'text-slate-700';

                              if (row.status === 'Present') {
                                borderClass = 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/10 hover:bg-emerald-50/20';
                                textClass = 'text-emerald-700';
                              } else if (row.status === 'Late') {
                                borderClass = 'border-amber-200 hover:border-amber-400 bg-amber-50/20 hover:bg-amber-50/30';
                                textClass = 'text-amber-800';
                              } else if (row.status === 'Absent') {
                                borderClass = 'border-slate-205 hover:border-rose-350 bg-rose-50/5 hover:bg-rose-50/15';
                                textClass = 'text-rose-700';
                              } else if (row.status === 'Future') {
                                borderClass = 'border-slate-100 bg-slate-50/30 hover:bg-slate-50/50';
                                textClass = 'text-slate-405';
                              }

                              return (
                                <div
                                  key={cell.dateStr}
                                  onClick={() => {
                                    if (canEditTime) {
                                      setEditingDate(cell.dateStr);
                                      setEditingTimeStr(convert12to24(row.clockIn));
                                      setShowEditTimeModal(true);
                                    }
                                  }}
                                  className={`aspect-square border rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 flex flex-col justify-between transition-all duration-200 hover:shadow-xs group ${canEditTime ? 'cursor-pointer hover:border-blue-400 focus:outline-none' : 'cursor-default'} ${borderClass} ${bgClass}`}
                                  title={canEditTime ? 'Click to correct clock-in time' : undefined}
                                >
                                  {/* Top Row: Day & Badge */}
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold font-mono text-[11px] sm:text-xs text-slate-800 flex items-center gap-1">
                                      {cell.day}
                                      {canEditTime && (
                                        <Edit className="h-2.5 w-2.5 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      )}
                                    </span>
                                    {row.status === 'Absent' ? (
                                      <span className="text-[8px] sm:text-[9.5px] bg-rose-50 font-bold px-1 py-0.5 rounded text-rose-600 uppercase tracking-tight">ABS</span>
                                    ) : row.status === 'Late' ? (
                                      <span className="text-[8px] sm:text-[9.5px] bg-amber-50 font-bold px-1 py-0.5 rounded text-amber-700 uppercase tracking-tight">LATE</span>
                                    ) : row.status === 'Future' ? (
                                      null
                                    ) : (
                                      <span className="text-[8px] sm:text-[9.5px] bg-emerald-50 font-bold px-1 py-0.5 rounded text-emerald-700 uppercase tracking-tight">PRE</span>
                                    )}
                                  </div>

                                  {/* Center Clock/Details */}
                                  <div className="my-auto text-center py-1">
                                    {row.status === 'Absent' ? (
                                      <span className="text-[10px] sm:text-[11.5px] text-slate-400 font-extrabold tracking-tight">Absent</span>
                                    ) : row.status === 'Future' ? (
                                      <span className="text-[10px] sm:text-[11.5px] text-slate-300 font-semibold italic tracking-tight">-</span>
                                    ) : (
                                      <div className="space-y-0.5">
                                        <div className="text-[10px] sm:text-[11.5px] font-bold text-slate-700 flex items-center justify-center gap-1 font-mono">
                                          <Clock className="h-2.5 w-2.5 text-blue-500 hidden sm:inline" />
                                          {row.clockIn}
                                        </div>
                                        {row.lateMinutes > 0 && (
                                          <div className="text-[8.5px] sm:text-[10px] text-amber-600 font-semibold font-mono tracking-tight animate-pulse">
                                            {row.lateMinutes}m late
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  {row.overtimeHours > 0 && (
                                    <div className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-bold mb-1 select-none text-center font-mono">
                                      OT: +{row.overtimeHours}h
                                    </div>
                                  )}

                                  {/* Bottom Payout Info */}
                                  <div className="border-t border-slate-100/50 pt-1 flex flex-col xs:flex-row xs:items-center justify-between text-[8px] sm:text-[9.5px] font-mono font-bold gap-0.5">
                                    {row.deduction > 0 ? (
                                      <span className="text-rose-605 font-bold tracking-tight shrink-0">-₱{row.deduction}</span>
                                    ) : (
                                      <span className="text-slate-400 shrink-0">no ded.</span>
                                    )}
                                    <span className={`text-[10px] sm:text-xs font-extrabold text-right ${textClass}`}>₱{row.earned}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      {calculations?.breakdown.length === 0 && (
                        <div className="bg-slate-50 border border-slate-100/80 rounded-xl p-8 text-center text-slate-455 font-bold">
                          All timecards in this selection range have been settled, or no work logs recorded.
                        </div>
                      )}
                    </div>
                    {/* ORIGINAL TABLE REMOVED */}
                    {false && (
                    <div className="overflow-x-auto px-4">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b uppercase font-bold text-slate-400 h-8">
                            <th className="py-2 pl-2">Scheduled Date</th>
                            <th className="py-2">Attendance Status</th>
                            <th className="py-2 font-mono">Earliest IN Timestamp</th>
                            <th className="py-2 text-right">Lateness</th>
                            <th className="py-2 text-right text-rose-650">Late Penalty</th>
                            <th className="py-2 text-right text-indigo-650">Overtime Details</th>
                            <th className="py-2 text-right text-emerald-750 pr-2">Total Day Earning</th>
                            {canEditTime && <th className="py-2 text-center pr-2">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {calculations?.breakdown.map((row) => (
                            <tr key={row.date} className="hover:bg-slate-50/30 transition h-10">
                              <td className="py-2 pl-2 font-bold text-slate-700 font-mono">
                                {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="py-2">
                                {row.status === 'Absent' ? (
                                  <span className="bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded text-[8.5px] uppercase">
                                    Absent
                                  </span>
                                ) : row.status === 'Late' ? (
                                  <span className="bg-rose-50 border border-rose-100 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[8.5px] uppercase">
                                    Late
                                  </span>
                                ) : row.status === 'Future' ? (
                                  <span className="text-slate-400 font-mono text-[9px] uppercase tracking-wider">
                                    -
                                  </span>
                                ) : (
                                  <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[8.5px] uppercase">
                                    Present
                                  </span>
                                )}
                              </td>
                              <td className="py-2 font-mono text-slate-600">{row.clockIn}</td>
                              <td className="py-2 text-right font-mono font-semibold">
                                {row.lateMinutes > 0 ? (
                                  <span className="text-rose-650">{row.lateMinutes} mins</span>
                                ) : (
                                  <span className="text-slate-405">{row.lateMinutes !== undefined ? '-' : '-'}</span>
                                )}
                              </td>
                              <td className="py-2 text-right font-mono font-bold text-rose-650">
                                {row.deduction > 0 ? (
                                  <>-₱{row.deduction}</>
                                ) : (
                                  <span className="text-slate-350">-</span>
                                )}
                              </td>
                              <td className="py-2 text-right font-mono font-bold text-indigo-600">
                                {row.overtimeHours > 0 ? (
                                  <span>{row.overtimeHours} hrs (+₱{row.overtimePay.toLocaleString()})</span>
                                ) : (
                                  <span className="text-slate-350">-</span>
                                )}
                              </td>
                              <td className="py-2 text-right font-mono font-black text-slate-800 pr-2">
                                ₱{row.earned.toLocaleString()}
                              </td>
                              {canEditTime && (
                                <td className="py-2 text-center pr-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDate(row.date);
                                      setEditingTimeStr(convert12to24(row.clockIn));
                                      setShowEditTimeModal(true);
                                    }}
                                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition inline-flex items-center gap-1 font-bold text-[10px] cursor-pointer"
                                    title="Edit clock-in time"
                                  >
                                    <Edit className="h-3 w-3" /> Edit
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}

                          {calculations?.breakdown.length === 0 && (
                            <tr>
                              <td colSpan={canEditTime ? 8 : 7} className="text-center py-6 text-slate-455 font-semibold">
                                All timecards in this selection range have been settled, or no work logs recorded.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Explanatory rules block */}
                  <div className="mx-4 p-3 bg-slate-50 border rounded-xl text-slate-600 leading-relaxed text-[10px] space-y-1.5">
                    <p className="font-extrabold text-slate-800 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      Strict IT Staff Late Penalty Clause Calculations:
                    </p>
                    <ul className="list-disc pl-4 space-y-0.5 list-inside">
                      <li>Shift Hours: <strong>8:00 AM - 5:00 PM</strong> (total elapsed time 9 hours).</li>
                      <li>Standard REST / Lunch Break: <strong>12:00 PM - 1:00 PM</strong>. <strong>There is no need to clock in or clock out during this break.</strong></li>
                      <li>Deductions trigger instantly pro-rata for any clock-ins after <strong>08:00 AM</strong>.</li>
                      <li>Checking in past 5:00 PM or taking a full absence deducts 100% (₱{conversationalITRate(calculations?.summary.dailyRate || 440)}) of that day's base salary.</li>
                    </ul>
                  </div>

                </div>

              </div>
            ) : (
              <div className="bg-white rounded-xl p-12 text-center border border-slate-100 shadow-sm">
                <ShieldAlert className="h-10 w-10 text-slate-300 mx-auto animate-pulse" />
                <h3 className="font-bold text-slate-700 text-sm mt-3">Select IT Staff Member</h3>
                <p className="text-slate-400 text-[10px] mt-1">Please pick an active operating IT Personnel on the left side menu to display computed ledger variables.</p>
              </div>
            )}

          </div>

        </div>
      ) : (
        /* Historical Settled Logs Archive Segment Panel */
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="border-b pb-3 flex justify-between items-center flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Archive className="h-4 w-4 text-slate-600 animate-pulse" />
                Settled IT Weekly Payroll Ledger Archive
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Historical overview of weekly IT salary settlements across sessions.</p>
            </div>
            
            {settledLogs.length > 0 && (
              <button
                onClick={() => handleExportSettleLogs(settledLogs)}
                className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-[10.5px] transition flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" /> Export Logs CSV
              </button>
            )}
          </div>

          {((isItUserOnly 
            ? settledLogs.filter(log => log.userEmail === currentUser.email || log.userId === currentUser.id)
            : settledLogs
          ).length === 0) ? (
            <div className="text-center py-16 text-slate-400 font-bold space-y-2">
              <Archive className="h-10 w-10 text-slate-300 mx-auto" />
              <div>No settled IT weekly payroll receipts found.</div>
              <p className="font-medium text-[9px] text-slate-400">Once an administrator settles an IT officer's payroll cycle, historical records will persist securely here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(isItUserOnly 
                ? settledLogs.filter(log => log.userEmail === currentUser.email || log.userId === currentUser.id)
                : settledLogs
              ).map((log) => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div key={log.id} className="border border-slate-100 rounded-xl overflow-hidden hover:border-slate-200 transition bg-white shadow-2xs">
                    <div 
                      className="bg-slate-50/50 p-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                      onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 bg-blue-50 text-blue-700 rounded-lg shrink-0">
                          <Coins className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 text-[11px] flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{log.userName}</span>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-[9.5px] bg-sky-50 border border-sky-100 p-0.5 px-1.5 text-blue-700 rounded-md">₱{log.totalEarned.toLocaleString()} settled</span>
                          </div>
                          <p className="text-[9.5px] text-slate-400 mt-0.5 font-semibold">Scheduled Date Range: {log.dateRange}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right text-[9.5px]">
                          <span className="text-slate-400 block">Settled {log.paidDate}</span>
                          <strong className="text-slate-600 font-bold">By {log.settledBy}</strong>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-405" /> : <ChevronDown className="h-4 w-4 text-slate-405" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-4 bg-white border-t border-slate-50 space-y-4 animate-fade-in text-[10px]">
                        {/* Summary receipts */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Base Rate Standard</span>
                            <strong className="font-mono font-bold text-slate-700 mt-1 block">₱{log.dailyRate}/day</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Days Attended</span>
                            <strong className="font-bold text-emerald-600 mt-1 block">{log.daysPresent} present / {log.daysAbsent} absent</strong>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[8px] font-bold uppercase tracking-wider">Total Late Deductions</span>
                            <strong className="font-mono font-bold text-rose-505 mt-1 block">-₱{log.totalDeductions}</strong>
                          </div>
                          <div>
                            <span className="text-teal-700 block text-[8px] font-black uppercase tracking-wider">Net Amount Disbursed</span>
                            <strong className="font-mono font-black text-emerald-705 text-sm mt-0.5 block">₱{log.totalEarned.toLocaleString()}</strong>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handlePrintPayroll(
                              log.userName,
                              log.userEmail,
                              log.dateRange,
                              log.dailyRate,
                              log.daysPresent,
                              log.daysAbsent,
                              log.totalLateMinutes || 0,
                              log.totalDeductions,
                              log.totalEarned,
                              log.breakdown,
                              log.settledBy,
                              log.paidDate
                            )}
                            className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-[9.5px] transition shadow-2xs cursor-pointer"
                            title="Print Archived Official Payslip"
                          >
                            <Printer className="h-3.5 w-3.5 text-emerald-600" /> Print Official Payslip Receipt
                          </button>
                        </div>

                        {/* Statement memo */}
                        {log.remarks && (
                          <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-2.5 text-amber-900 text-[9.5px]">
                            <strong>Settlement Remarks:</strong> {log.remarks}
                          </div>
                        )}

                        {/* Detailed breakdown timesheet log */}
                        <div className="space-y-1.5">
                          <h4 className="font-bold text-slate-705 text-[10px] flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-slate-450" />
                            Archived statement daily logs trail:
                          </h4>
                          <div className="overflow-x-auto border border-slate-100 rounded-xl">
                            <table className="w-full text-left text-[9px] border-collapse">
                              <thead>
                                <tr className="bg-slate-50/40 border-b uppercase font-bold text-slate-400 h-7 text-[8px]">
                                  <th className="py-1.5 pl-2">Scheduled Date</th>
                                  <th className="py-1.5">Punch Status</th>
                                  <th className="py-1.5 font-mono">Timestamp IN</th>
                                  <th className="py-1.5 text-right">Lateness</th>
                                  <th className="py-1.5 text-right text-rose-650">Deduction</th>
                                  <th className="py-1.5 text-right text-emerald-700 pr-2">Earning</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                {log.breakdown?.map((row: any) => (
                                  <tr key={row.date} className="h-8">
                                    <td className="py-1 pl-2 font-mono font-bold text-slate-700">
                                      {new Date(row.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td>
                                      {row.status === 'Absent' ? (
                                        <span className="bg-slate-100 text-slate-500 font-bold px-1.5 py-0.2 rounded text-[7.5px] uppercase">Absent</span>
                                      ) : row.status === 'Late' ? (
                                        <span className="bg-rose-50 border border-rose-100 text-rose-700 font-bold px-1.5 py-0.2 rounded text-[7.5px] uppercase">Late</span>
                                      ) : row.status === 'Future' ? (
                                        <span className="text-slate-400 font-mono text-[7.5px] uppercase tracking-wider">-</span>
                                      ) : (
                                        <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-1.5 py-0.2 rounded text-[7.5px] uppercase">Present</span>
                                      )}
                                    </td>
                                    <td className="font-mono text-slate-600">{row.clockIn}</td>
                                    <td className="text-right font-mono font-semibold">
                                      {row.lateMinutes > 0 ? <span className="text-rose-650">{row.lateMinutes} mins</span> : '-'}
                                    </td>
                                    <td className="text-right font-mono font-bold text-rose-650">
                                      {row.deduction > 0 ? `-₱${row.deduction}` : '-'}
                                    </td>
                                    <td className="text-right font-mono font-black text-slate-800 pr-2">
                                      ₱{row.earned}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settle Payroll Confirmation Modal Dialog */}
      {showSettleModal && activeStaffToCalculate && calculations && (
        <div className="fixed inset-0 z-[10020] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Settle Weekly Payroll Statement
              </h3>
              <button 
                onClick={() => setShowSettleModal(false)}
                className="text-slate-400 hover:text-slate-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4 text-left">
              <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-100/70">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400 font-semibold">IT Officer:</span>
                  <strong className="text-slate-800 font-bold">{activeStaffToCalculate.fullName}</strong>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">Email:</span>
                  <span className="text-slate-600 font-mono font-medium">{activeStaffToCalculate.email}</span>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">Settlement Period:</span>
                  <strong className="text-blue-700 font-mono font-bold">{dateFrom} to {dateTo}</strong>
                </div>
                <div className="border-t border-slate-200/50 my-2 pt-2 flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-405 font-semibold">Days Scheduled:</span>
                  <strong className="text-slate-750 font-mono">{calculations.summary.totalDays} days</strong>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-405 font-semibold">Present/Attended:</span>
                  <strong className="text-emerald-700 font-mono">{calculations.summary.daysPresent} days</strong>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-405 font-semibold">Late Deductions:</span>
                  <strong className="text-rose-605 font-mono">-₱{calculations.summary.totalDeductions}</strong>
                </div>
                <div className="border-t border-slate-200 mt-2.5 pt-2 flex justify-between items-center">
                  <span className="text-teal-800 font-bold text-[11px]">Net Paid Amount:</span>
                  <strong className="text-teal-700 text-sm font-mono font-black">₱{calculations.summary.totalEarned.toLocaleString()}</strong>
                </div>
              </div>

              {/* Remarks option */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block font-bold">Settlement Memo / Remarks</label>
                <textarea
                  value={settleRemarks}
                  onChange={(e) => setSettleRemarks(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-[10.5px] text-slate-700 bg-white placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="Memo (e.g. Paid via digital transfer / direct banking)."
                />
              </div>

              <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3 flex gap-2 text-amber-800 text-[9.5px]">
                <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-600" />
                <p className="font-medium leading-relaxed">
                  <strong>Important:</strong> Settle action marks all active timecards for this range as <strong>settled</strong>, resetting this week's active payroll record. Historical receipt logs will be preserved permanently.
                </p>
              </div>

              <div className="flex gap-2 border-t pt-3 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 font-bold py-1.5 px-3.5 rounded-lg text-slate-650 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-4 rounded-lg flex items-center justify-center gap-1 transition shadow-xs cursor-pointer min-w-[100px]"
                >
                  {isSettling ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-solid border-white border-r-transparent"></span>
                  ) : (
                    <>Confirm & Settle</>
                  )}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Clear Attendance Confirmation Modal Dialog */}
      {showClearConfirmModal && activeStaffToCalculate && (
        <div className="fixed inset-0 z-[10020] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-rose-800 flex items-center gap-1.5">
                <AlertCircle className="h-5 w-5 text-rose-600" />
                Clear Calendar Attendance Logs
              </h3>
              <button 
                onClick={() => setShowClearConfirmModal(false)}
                className="text-slate-400 hover:text-slate-700 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-left">
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                You are about to clear the calendar attendance and timecard logs of <strong>{activeStaffToCalculate.fullName}</strong> ({activeStaffToCalculate.email}).
              </p>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">IT Staff Member:</span>
                  <strong className="text-slate-800">{activeStaffToCalculate.fullName}</strong>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">Clearing Range:</span>
                  <strong className="text-rose-700 font-mono">{dateFrom} to {dateTo}</strong>
                </div>
              </div>

              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2 text-rose-800 text-[9.5px]">
                <ShieldAlert className="h-4.5 w-4.5 shrink-0 text-rose-600 animate-pulse" />
                <p className="font-medium leading-relaxed">
                  <strong>Permanent Action:</strong> This will delete all attendance records, timecards, clock-ins, and clock-outs matching this officer for the range specified. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3 mt-4 justify-end">
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(false)}
                className="bg-slate-100 hover:bg-slate-200 font-bold py-1.5 px-3.5 rounded-lg text-slate-650 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isClearing}
                onClick={handleClearAttendance}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-4 rounded-lg flex items-center justify-center gap-1 transition shadow-xs cursor-pointer min-w-[100px]"
              >
                {isClearing ? (
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-solid border-white border-r-transparent"></span>
                ) : (
                  <>Clear Now</>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Edit Attendance Clock-In Time Modal Dialog */}
      {showEditTimeModal && editingDate && activeStaffToCalculate && (
        <div className="fixed inset-0 z-[10020] overflow-y-auto flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl overflow-hidden p-6 space-y-4">
            
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-sm font-black text-blue-800 flex items-center gap-1.5 uppercase font-sans">
                <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                Correct Clock-In Time
              </h3>
              <button 
                onClick={() => setShowEditTimeModal(false)}
                className="text-slate-400 hover:text-slate-700 font-extrabold text-sm transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-left">
              <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                Manually configure or correct the <strong className="text-blue-650">Time-In</strong> record for <strong>{activeStaffToCalculate.fullName}</strong>.
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">IT Staff Member:</span>
                  <strong className="text-slate-800">{activeStaffToCalculate.fullName}</strong>
                </div>
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-450 font-semibold">Duty Date:</span>
                  <strong className="text-blue-700 font-mono">{editingDate}</strong>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Set Time-In (8:00 AM Standard)</label>
                <input
                  type="time"
                  value={editingTimeStr}
                  onChange={(e) => setEditingTimeStr(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-700 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-[9px] text-slate-400 mt-1.5 leading-relaxed font-semibold">
                  Standard schedule starts at 8:00 AM. 15-minute grace period allowance is applied automatically. Leave empty to clear attendance (marks as Absent).
                </p>
              </div>
            </div>

            <div className="flex gap-2 border-t pt-3 mt-4 justify-between">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Are you sure you want to remove the time-in log for this day? This will mark the staff as Absent.")) {
                    await handleSaveTime('');
                  }
                }}
                disabled={isUpdatingTime}
                className="bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold py-1.5 px-3 rounded-lg text-[10px] transition cursor-pointer"
              >
                Mark Absent (Clear)
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditTimeModal(false)}
                  className="bg-slate-100 hover:bg-slate-200 font-bold py-1.5 px-3 rounded-lg text-slate-650 text-[10px] transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isUpdatingTime}
                  onClick={() => handleSaveTime(editingTimeStr)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-4 rounded-lg flex items-center justify-center gap-1 transition shadow-xs text-[10px] cursor-pointer min-w-[80px]"
                >
                  {isUpdatingTime ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-solid border-white border-r-transparent"></span>
                  ) : (
                    <>Save Time</>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

const conversationalITRate = (val: number) => {
  return typeof val === 'number' ? val.toLocaleString() : '440';
};
