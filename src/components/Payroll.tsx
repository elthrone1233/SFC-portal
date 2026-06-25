import React, { useEffect, useState } from 'react';
import { Coins, ClipboardCheck, ArrowUpRight, Download, Calendar, Archive, FileText, CheckCircle2, CheckCircle, AlertCircle, Folder, FolderOpen, ArrowLeft } from 'lucide-react';
import { User, PaidPayroll } from '../types';

interface PayrollProps {
  currentUser: User;
}

export default function Payroll({ currentUser }: PayrollProps) {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [paidList, setPaidList] = useState<PaidPayroll[]>([]);
  const [dbBarangays, setDbBarangays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<'calc' | 'archive'>('calc');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showPayoutPopup, setShowPayoutPopup] = useState(false);

  // Settle modal states
  const [selectedPay, setSelectedPay] = useState<any>(null);
  const [dateFrom, setDateFrom] = useState('2026-05-01');
  const [dateTo, setDateTo] = useState('2026-05-31');
  const [remarks, setRemarks] = useState('');

  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const getFolderPayrolls = (fName: string | null) => {
    if (!fName) return [];
    const target = fName.toLowerCase().trim();
    return payrolls.filter(p => {
      const assigned = (p.assignedBarangays || []).map((b: string) => b.toLowerCase().trim());
      if (target === 'san pedro') {
        return assigned.includes(target) || assigned.length === 0 || assigned.includes('unassigned');
      }
      return assigned.includes(target);
    });
  };

  useEffect(() => {
    fetchBarangays();
    fetchPayrollData();
    fetchPaidArchive();
  }, []);

  const fetchBarangays = async () => {
    try {
      const res = await fetch('/api/barangays');
      if (res.ok) {
        const data = await res.json();
        setDbBarangays(data.barangays || []);
      }
    } catch(err) {
      console.error(err);
    }
  };

  const fetchPayrollData = async () => {
    try {
      const res = await fetch('/api/payroll', {
        headers: { 'x-user-email': currentUser.email }
      });
      if (res.ok) {
        const data = await res.json();
        setPayrolls(data);
      }
    } catch(e) {}
    finally {
      setLoading(false);
    }
  };

  const fetchPaidArchive = async () => {
    try {
      const res = await fetch('/api/payroll/paid');
      if (res.ok) {
        const data = await res.json();
        setPaidList(data);
      }
    } catch(e){}
  };

  const handleOpenSettle = (pay: any) => {
    setSelectedPay(pay);
    setDateFrom(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setDateTo(new Date().toISOString().split('T')[0]);
    setRemarks(`Operating payouts settled by ${currentUser.fullName}`);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPay) return;

    try {
      const res = await fetch('/api/payroll/settle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          groupId: selectedPay.groupId,
          dateFrom,
          dateTo,
          remarks
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
        // Silently caught - handled in non-JSON check below
      }

      const isHtmlResponse = rawText.trim().startsWith('<') || rawText.trim().toLowerCase().startsWith('<!doctype');
      if (!isJson || isHtmlResponse) {
        console.error('Non-JSON/HTML error response raw text for debugging:', rawText);
      }

      if (res.ok) {
        setAlertModal({
          isOpen: true,
          title: 'Payroll Ledgers Settled',
          description: 'The operation payout has been settled and permanently recorded inside the active Saint Francis Clinic Archive.',
          type: 'success'
        });
        setSelectedPay(null);
        fetchPayrollData();
        fetchPaidArchive();
      } else {
        let errMsg = 'The system could not complete the group payroll settlement.';
        if (isJson && parsedData && parsedData.error) {
          errMsg = parsedData.error;
        } else {
          // Fallback display if server returns HTML error pages: strip tags and truncate
          const cleanText = rawText.replace(/<\/?[^>]+(>|$)/g, " ").trim();
          const truncated = cleanText.length > 180 ? cleanText.substring(0, 180) + '...' : cleanText;
          errMsg = truncated ? `Server Error: ${truncated}` : `Server returned status code ${res.status}.`;
        }
        
        setAlertModal({
          isOpen: true,
          title: 'Settlement Error',
          description: errMsg,
          type: 'danger'
        });
      }
    } catch(e: any) {
      console.error('Connection catch block error during settlement:', e);
      setAlertModal({
        isOpen: true,
        title: 'Connection Error',
        description: e.message || 'A network error occurred while submitting settlement data.',
        type: 'danger'
      });
    }
  };

  // CSV/Excel Export function trigger inside client
  const handleExportCSV = (list: PaidPayroll[]) => {
    if (list.length === 0) return;
    const header = 'ID,Group Name,Date Range,Population Count,Rate,Total Paid,Paid Date,Settled By,Remarks\n';
    const rows = list.map(item => 
      `"${item.id}","${item.groupName}","${item.dateRange}",${item.populationCount},${item.ratePerPerson},${item.totalAmountPaid},"${item.paidDate}","${item.settledBy}","${item.remarks || ''}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SFC_Settled_Payrolls_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-sans text-xs">
      
      {/* Tab Switcher and Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <Coins className="h-5 w-5 text-blue-600 animate-pulse" />
            Field Operations Payroll ledger
          </h2>
          <p className="text-slate-400 text-[10px] mt-1">Calculate and disburse team payouts based on approved citizen records</p>
        </div>

        <div className="flex border border-slate-200 bg-slate-50 rounded-lg p-0.5 self-stretch sm:self-auto">
          <button
            onClick={() => setActiveSegment('calc')}
            className={`flex-1 sm:flex-none text-center px-4 py-1.5 rounded-md font-semibold font-sans transition ${
              activeSegment === 'calc' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5 inline mr-1.5" /> calculation
          </button>
          <button
            onClick={() => setActiveSegment('archive')}
            className={`flex-1 sm:flex-none text-center px-4 py-1.5 rounded-md font-semibold font-sans transition ${
              activeSegment === 'archive' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Archive className="h-3.5 w-3.5 inline mr-1.5" /> Settled Archives
          </button>
        </div>
      </div>

      {activeSegment === 'calc' ? (
        loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
          </div>
        ) : (
          (() => {
            // Dynamic calculations
            const activePayrolls = payrolls.filter(p => !p.isArchived);
            const grandTotalPayout = activePayrolls.reduce((sum, p) => sum + (p.totalPayout || 0), 0);

            const folderNamesMap = new Map<string, string>();
            // Add from dbBarangays first to preserve original config casing
            dbBarangays.forEach(b => {
              if (b.name && b.name.trim()) {
                const nameTrimmed = b.name.trim();
                folderNamesMap.set(nameTrimmed.toLowerCase(), nameTrimmed);
              }
            });
            // Add remaining assignedBarangays from payrolls
            payrolls.flatMap(p => p.assignedBarangays || []).forEach(b => {
              if (b && b.trim()) {
                const nameTrimmed = b.trim();
                const key = nameTrimmed.toLowerCase();
                if (key !== 'unassigned' && !folderNamesMap.has(key)) {
                  folderNamesMap.set(key, nameTrimmed);
                }
              }
            });
            const allFolders = Array.from(folderNamesMap.values()).sort((a, b) => a.localeCompare(b));

            const getPayrollsInFolder = (fName: string) => {
              const target = fName.toLowerCase().trim();
              return payrolls.filter(p => {
                const assigned = (p.assignedBarangays || []).map((b: string) => b.toLowerCase().trim());
                if (target === 'san pedro') {
                  // Direct SAN PEDRO squads or unassigned squads move here automatically
                  return assigned.includes(target) || assigned.length === 0 || assigned.includes('unassigned');
                }
                return assigned.includes(target);
              });
            };

            const renderPayrollCard = (p: any, idx: number) => {
              const isArchived = !!p.isArchived;
              const defaultDate = p.createdAt || '2026-06-10';
              const statusName = p.status || (p.populationCount > 0 ? 'Approved' : 'Pending');

              return (
                <div key={idx} id={`payroll-card-${idx}`} className={`bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between ${isArchived ? 'opacity-75 border-slate-200 bg-slate-50/70 border-dashed' : ''}`}>
                  <div>
                    {/* Header: Folders/Group name and Status badge */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        📁 Group: {p.assignedBarangays && p.assignedBarangays.length > 0 ? p.assignedBarangays[0] : 'Unassigned'}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[8px] tracking-wider border ${
                        statusName === 'Paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        statusName === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        statusName === 'Archived' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {statusName}
                      </span>
                    </div>

                    <div className="flex justify-between items-start mb-3">
                      <div>
                        {/* Squad Name */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-extrabold text-slate-800 text-sm leading-none">🛡️ Squad: {p.groupName.toLowerCase().endsWith('payroll') ? p.groupName : `${p.groupName} Payroll`}</h3>
                          {isArchived && (
                            <span className="bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider flex items-center gap-0.5">
                              <Archive className="h-2 w-2 text-slate-500" /> Archived folder
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1.5 block font-medium">Leader: {p.leaderName}</span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block font-mono">📅 Created: {defaultDate}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold font-mono text-[10px] ${isArchived ? 'bg-slate-100 text-slate-500' : 'bg-blue-50 text-blue-700'}`}>
                        ₱{p.ratePerPerson} / head
                      </span>
                    </div>

                    {/* Population Count & Calculation Info */}
                    <div className="grid grid-cols-3 gap-2 text-center my-4 bg-slate-50/55 p-2.5 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold leading-none uppercase">Population</span>
                        <strong className="text-slate-700 font-bold block mt-1.5 text-xs">{p.populationCount}</strong>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold leading-none uppercase">Base Rate</span>
                        <strong className="text-slate-700 text-xs font-mono block mt-1.5">₱{p.ratePerPerson}</strong>
                      </div>
                      <div>
                        <span className={`text-[9px] block font-bold leading-none uppercase ${isArchived ? 'text-slate-400' : 'text-blue-500'}`}>Computed Payroll</span>
                        <strong className={`font-bold font-mono hover:scale-105 block mt-1.5 text-xs ${isArchived ? 'text-slate-500' : 'text-blue-700'}`}>
                          ₱{p.totalPayout.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {/* Dynamic Squad Personnel list */}
                    {p.squadPersonnel && p.squadPersonnel.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-150/60 space-y-1.5 text-[10px]">
                        <span className="block text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">👥 Synchronized Squad Employees</span>
                        <div className="flex flex-wrap gap-1">
                          {p.squadPersonnel.map((member: any, mIdx: number) => (
                            <span key={mIdx} className="inline-flex items-center gap-1 bg-slate-50 text-slate-600 border border-slate-200/50 px-1.5 py-0.5 rounded font-medium text-[9px]">
                              <span className="font-extrabold text-slate-800">{member.fullName}</span> 
                              <span className="text-slate-400 text-[8px]">({member.position})</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-50 pt-3 mt-3 flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-mono text-[9px]">{isArchived ? 'Archived Record (Non-Active)' : 'Strict Approved Formula Applied'}</span>
                    {!isArchived ? (
                      <button
                        id={`btn-settle-pay-${idx}`}
                        onClick={() => handleOpenSettle(p)}
                        className="btn-3d-primary px-3 py-1.5 flex items-center gap-1 font-bold text-[10px] rounded-lg cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Settle & Pay
                      </button>
                    ) : (
                      <span className="text-[9px] text-slate-400 font-semibold italic">Locked Archive</span>
                    )}
                  </div>
                </div>
              );
            };

            return (
              <div className="space-y-6">
                {/* If selectedFolder is not null, open directory */}
                {selectedFolder !== null ? (
                  <div className="space-y-4 animate-fade-in">
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-100 p-3.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedFolder(null)}
                          className="p-1.5 px-3 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-lg border transition text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Back to folders
                        </button>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                          <FolderOpen className="h-4 w-4 text-emerald-600 animate-pulse" />
                          <span>Barangay Ledger Directories</span>
                          <span className="text-slate-400 font-normal">/</span>
                          <span className="text-blue-800 uppercase font-extrabold">{selectedFolder}</span>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <button
                          type="button"
                          id="btn-total-payout-modal-open"
                          onClick={() => setShowPayoutPopup(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold uppercase text-[10px] py-1.5 px-3 rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1 shrink-0"
                        >
                          <Coins className="h-3.5 w-3.5" /> TOTAL PAYOUT
                        </button>
                        <span className="text-[11px] text-slate-500 font-bold bg-white p-1 px-2.5 rounded-lg border border-slate-200 shadow-2xs">
                          Subtotal Folder Payout: 
                          <span className="text-teal-700 ml-1 font-mono font-black">
                            ₱{getPayrollsInFolder(selectedFolder).filter(p => !p.isArchived).reduce((sum, item) => sum + (item.totalPayout || 0), 0).toLocaleString()}
                          </span>
                        </span>
                        <span className="px-2.5 py-1 bg-slate-800 text-white font-bold rounded-full text-[10px] font-mono">
                          {getPayrollsInFolder(selectedFolder).filter(p => !p.isArchived).length} {getPayrollsInFolder(selectedFolder).filter(p => !p.isArchived).length === 1 ? 'Active Team' : 'Active Teams'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {getPayrollsInFolder(selectedFolder).map((p, idx) => renderPayrollCard(p, idx))}
                    </div>

                    {getPayrollsInFolder(selectedFolder).length === 0 && (
                      <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                        No team payrolls are currently calculated under {selectedFolder}.
                      </div>
                    )}
                  </div>
                ) : (
                  /* Render Directories List */
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-slate-50 border p-3 rounded-xl flex items-center gap-2 text-slate-600 font-medium text-[11px]">
                      <Folder className="h-4 w-4 text-emerald-600 animate-bounce" />
                      <span>Select any Barangay Operational payroll ledger folder below to review and calculate squad payouts:</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                      {allFolders.map((f) => {
                        const folderPayrolls = getPayrollsInFolder(f);
                        const activeFolderPayrolls = folderPayrolls.filter(p => !p.isArchived);
                        const folderSubtotal = activeFolderPayrolls.reduce((sum, item) => sum + (item.totalPayout || 0), 0);
                        return (
                          <div
                            key={f}
                            onClick={() => setSelectedFolder(f)}
                            className="group flex flex-col items-center justify-between p-4 bg-white hover:bg-emerald-50/10 border border-slate-150/60 rounded-2xl cursor-pointer hover:shadow-md hover:border-emerald-250 transition duration-200 text-center relative"
                          >
                            {/* Stylized Folder Graphic at Top */}
                            <div className="relative w-16 h-12 my-2 flex items-center justify-center">
                              {/* Tab Background */}
                              <div className="absolute top-0 left-1 w-6 h-2 bg-emerald-600 rounded-t-sm group-hover:bg-yellow-500 transition-colors"></div>
                              {/* Folder main cardboard layer */}
                              <div className="absolute bottom-0 left-0 w-full h-10 bg-emerald-500 rounded-md shadow-2xs group-hover:bg-yellow-400 transition-colors border-t border-emerald-400 group-hover:border-yellow-300">
                                {/* Cash / balance icon indicating ledger state inside the folder pocket */}
                                <div className="absolute bottom-1 right-1 left-1 bg-white/95 text-emerald-800 border border-emerald-100 rounded text-[7px] font-mono font-black scale-[0.85] truncate px-0.5 leading-tight">
                                  ₱{folderSubtotal.toLocaleString()}
                                </div>
                              </div>
                            </div>

                            {/* Folder label / Name Below the Folder */}
                            <div className="mt-2 w-full text-center">
                              <span className="font-extrabold text-slate-800 text-[11px] uppercase tracking-tight line-clamp-2 leading-tight group-hover:text-amber-700 transition">
                                {f}
                              </span>
                              <div className="text-[9px] text-teal-700 font-bold font-mono mt-0.5">
                                ₱{folderSubtotal.toLocaleString()}
                              </div>
                              <div className="text-[8px] text-slate-400 font-medium font-sans uppercase mt-0.5">
                                {activeFolderPayrolls.length} {activeFolderPayrolls.length === 1 ? 'Team' : 'Teams'}
                                {folderPayrolls.length > activeFolderPayrolls.length && (
                                  <span className="block text-[7px] text-amber-600 font-bold mt-0.5 font-mono">
                                    (+{folderPayrolls.length - activeFolderPayrolls.length} Archived)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )
      ) : (
        /* ARCHIVE SECTION LIST */
        <div className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">Settled Receipts Database</h3>
            {paidList.length > 0 && (
              <button
                onClick={() => handleExportCSV(paidList)}
                className="flex items-center gap-1 border border-slate-200 text-slate-600 hover:text-slate-950 font-semibold px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 transition"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" /> Export CSV Ledger
              </button>
            )}
          </div>

          {paidList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              No payroll accounts settled yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded border border-slate-50">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 h-10 uppercase text-[10px] font-semibold text-slate-500">
                    <th className="py-2 pl-4">Payout ID</th>
                    <th className="py-2">Team Group</th>
                    <th className="py-2">Invoice Range</th>
                    <th className="py-2">Pop count</th>
                    <th className="py-2">Individual Rate</th>
                    <th className="py-2">Total amount Paid</th>
                    <th className="py-2">Settlement Date</th>
                    <th className="py-2 pr-4 text-right">Approving officer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paidList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3 pl-4 font-mono font-medium text-slate-400">{item.id}</td>
                      <td className="py-3 font-semibold text-slate-800">{item.groupName}</td>
                      <td className="py-3 font-medium text-slate-500">{item.dateRange}</td>
                      <td className="py-3 font-mono">{item.populationCount} heads</td>
                      <td className="py-3 font-mono">₱{item.ratePerPerson}</td>
                      <td className="py-3 font-bold text-emerald-600 font-mono">₱{item.totalAmountPaid.toLocaleString()}</td>
                      <td className="py-3 text-slate-400 font-mono">{item.paidDate}</td>
                      <td className="py-3 pr-4 text-right font-medium text-slate-600">{item.settledBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONFIRM PAYROLL SETTLEMENT SCREEN DIALOG */}
      {selectedPay && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl relative border">
            <h2 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <Coins className="h-5 w-5 text-emerald-600" />
              Settle Field Squad Payroll
            </h2>
            <p className="text-slate-400 text-[10px] mb-4">Complete operating details to stamp the payment voucher persistently.</p>
            <button 
              onClick={() => setSelectedPay(null)}
              className="absolute top-6 right-6 text-slate-300 hover:text-slate-500 font-bold"
            >
              ✕
            </button>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg space-y-1.5 text-slate-700 border">
                <p>Team: <strong className="text-slate-900">{selectedPay.groupName}</strong></p>
                <p>Registered Approved Count: <strong className="text-slate-900">{selectedPay.populationCount}</strong></p>
                <p>Subtotal Cost: <strong className="text-emerald-700 text-sm">₱{selectedPay.totalPayout.toLocaleString()} PHP</strong></p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Invoice Start Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Invoice Close Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="bg-slate-50 border p-2 w-full rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">Settlement remarks</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="bg-slate-50 border p-2 h-14 w-full rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedPay(null)}
                  className="flex-1 py-2 btn-3d-secondary font-bold text-[11px] uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 btn-3d-primary btn-pulse-save font-extrabold text-[11px] uppercase tracking-wider text-center cursor-pointer"
                >
                  Confirm Paid Stamp
                </button>
              </div>

             </form>
          </div>
        </div>
      )}

      {/* TOTAL PAYOUT BREAKDOWN POPUP MODAL */}
      {showPayoutPopup && selectedFolder && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans">
          <div className="absolute inset-0 bg-slate-950/65" onClick={() => setShowPayoutPopup(false)}></div>
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative border border-slate-150 animate-fade-in animate-scale-up z-[10011]">
            
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100">
                  <Coins className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">TOTAL PAYOUT SUMMARY</h2>
                  <p className="text-[10px] text-slate-400 font-bold block">
                    Barangay: <span className="text-blue-800 uppercase font-extrabold">{selectedFolder}</span>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowPayoutPopup(false)}
                className="text-slate-300 hover:text-slate-500 font-extrabold text-base transition-colors"
                id="btn-close-payout-popup"
              >
                ✕
              </button>
            </div>

            {/* List of leaders on this Barangay Folder with their total of Computed Payroll */}
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto mb-4 pr-1">
              <span className="block text-[8.5px] text-slate-450 font-extrabold uppercase tracking-wider mb-1">
                👥 Squad Leaders Ledger List & Computed Payouts
              </span>
              
              {(() => {
                const folderPayrolls = getFolderPayrolls(selectedFolder).filter(p => !p.isArchived);
                const leadersMap: { [leaderName: string]: number } = {};
                folderPayrolls.forEach(p => {
                  const leader = p.leaderName || 'Unknown Leader';
                  leadersMap[leader] = (leadersMap[leader] || 0) + (p.totalPayout || 0);
                });
                const leadersList = Object.entries(leadersMap).map(([name, total]) => ({
                  name,
                  total
                })).sort((a, b) => b.total - a.total);

                if (leadersList.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 font-bold border border-dashed rounded-xl bg-slate-50">
                      No active leaders or squad payroll records found in this folder.
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-white">
                    {leadersList.map((leader, i) => (
                      <div key={i} className="flex justify-between items-center p-3 hover:bg-slate-50/50 transition">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-extrabold text-slate-700 uppercase border border-slate-200">
                            {leader.name.charAt(0)}
                          </div>
                          <div>
                            <span className="font-extrabold text-slate-800 uppercase block leading-tight">{leader.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold">Squad Leader Ledger</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-emerald-700 text-xs">
                            ₱{leader.total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Separator and Subtotal Folder Payout */}
            <div className="pt-3.5 border-t border-slate-100">
              {(() => {
                const folderPayrolls = getFolderPayrolls(selectedFolder).filter(p => !p.isArchived);
                const folderSubtotal = folderPayrolls.reduce((sum, item) => sum + (item.totalPayout || 0), 0);
                return (
                  <div className="bg-slate-900 border border-slate-950 text-white p-4 rounded-xl flex items-center justify-between shadow-inner">
                    <div className="space-y-0.5">
                      <span className="text-[8.5px] text-emerald-400 font-extrabold uppercase tracking-widest block font-sans">
                        Subtotal Folder Payout
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold block leading-none">
                        Aggregated active squad payroll total
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-teal-400 text-sm">
                        ₱{folderSubtotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Action Buttons */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowPayoutPopup(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold border shadow-2xs active:translate-y-0.5 transition cursor-pointer text-xs uppercase"
              >
                Close Summary
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CUSTOM CENTERING ALERT POPUP MODAL */}
      {alertModal?.isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-md" onClick={() => setAlertModal(null)}></div>
          <div className="bg-white rounded-3xl border border-slate-150 shadow-2xl relative max-w-sm w-full overflow-hidden p-6 space-y-4 text-center z-[10001] animate-fade-in animate-scale-up">
            <div className="flex flex-col items-center gap-3 text-center">
              {alertModal.type === 'success' ? (
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 block">
                  <CheckCircle className="h-8 w-8 animate-bounce" />
                </span>
              ) : (
                <span className="p-3 bg-rose-50 text-rose-650 rounded-full border border-rose-100 block">
                  <AlertCircle className="h-8 w-8 animate-pulse" />
                </span>
              )}
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{alertModal.title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{alertModal.description}</p>
            </div>
            <button
              onClick={() => setAlertModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-850 hover:shadow-md transition duration-150 cursor-pointer text-xs uppercase tracking-wide font-sans text-center"
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
