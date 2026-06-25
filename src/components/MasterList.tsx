import React, { useEffect, useState } from 'react';
import { Search, Download, Filter, User, HelpCircle, Archive, Table, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { User as UserType } from '../types';

interface MasterListProps {
  currentUser: UserType;
}

export default function MasterList({ currentUser }: MasterListProps) {
  const [dataList, setDataList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [purokFilter, setPurokFilter] = useState('');
  const [masterPage, setMasterPage] = useState(1);
  const [civilFilter, setCivilFilter] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Selected citizen for view details modal
  const [selectedItem, setSelectedItem] = useState<any | null>(null);

  const handleViewDossier = async (item: any) => {
    setSelectedItem({ ...item, isLoadingDetails: true });
    try {
      const res = await fetch(`/api/households/${item.householdId}/all`);
      if (res.ok) {
        const details = await res.json();
        setSelectedItem({
          ...item,
          patientSignature: details.household?.patientSignature || details.household?.pmrfDetails?.patientSignature || null,
          attachments: details.household?.attachments || [],
          pmrfDetails: details.household?.pmrfDetails || null,
          fpeDetails: details.household?.fpeDetails || null,
          pcsfDetails: details.household?.pcsfDetails || null,
          isLoadingDetails: false
        });
      } else {
        setSelectedItem({ ...item, isLoadingDetails: false });
      }
    } catch (err) {
      setSelectedItem({ ...item, isLoadingDetails: false });
    }
  };

  useEffect(() => {
    fetchMasterList();
  }, []);

  const fetchMasterList = async () => {
    try {
      const res = await fetch('/api/masterlist');
      if (res.ok) {
        const data = await res.json();
        setDataList(data);
      }
    } catch(e) {}
    finally {
      setLoading(false);
    }
  };

  const filtered = dataList.filter(item => {
    const fn = item.fullName || '';
    const rl = item.role || '';
    const query = (searchTerm || '').toLowerCase();
    const matchSearch = fn.toLowerCase().includes(query) || rl.toLowerCase().includes(query);
    const matchBarangay = !barangayFilter || item.barangay === barangayFilter;
    const matchPurok = !purokFilter || item.purok === purokFilter;
    return matchSearch && matchBarangay && matchPurok;
  });

  // Pagination for citizen records
  const masterPageSize = 25;
  const totalMasterPages = Math.ceil(filtered.length / masterPageSize);
  const activeMasterPage = Math.min(masterPage, totalMasterPages > 0 ? totalMasterPages : 1);
  const paginatedData = filtered.slice((activeMasterPage - 1) * masterPageSize, activeMasterPage * masterPageSize);

  // Export excel spreadsheet
  const handleCSVDownload = () => {
    if (filtered.length === 0) return;
    const header = 'Full Name,Gender,Age,Address,Barangay,Purok,Recorded By,Date Added,Hierarchy Role\n';
    const rows = filtered.map(item => 
      `"${item.fullName}","${item.gender}",${item.age},"${item.address}","${item.barangay}","${item.purok}","${item.recordedBy}","${item.dateAdded}","${item.role}"`
    ).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Saint_Francis_Clinic_Masterlist_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const listBarangays = Array.from(new Set(dataList.map(item => item.barangay).filter(Boolean)));
  const listPuroks = Array.from(new Set(dataList
    .filter(item => !barangayFilter || item.barangay === barangayFilter)
    .map(item => item.purok)
    .filter(Boolean)
  ));

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4 font-sans text-xs">
      
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-1.5 leading-none">
            <Table className="h-5 w-5 text-blue-600" />
            General Citizen Masterlist Directory
          </h2>
          <p className="text-slate-400 text-[10px] mt-1">
            Aggregated grid of all Household Heads, verified Members, and registered Dependents
          </p>
        </div>

        {/* Export action download */}
        {filtered.length > 0 && (
          <button
            onClick={handleCSVDownload}
            className="flex items-center gap-1 border border-slate-200 text-slate-600 hover:text-slate-950 font-semibold px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition duration-150 cursor-pointer"
          >
            <Download className="h-4 w-4" /> Export CSV Spreadsheet
          </button>
        )}
      </div>

      {/* Inputs filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:flex-initial">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 pointer-events-none">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search citizen Name or role..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setMasterPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-lg text-xs py-2 pl-8 pr-2 w-full sm:w-48 focus:outline-none"
          />
        </div>

        <select
          value={barangayFilter}
          onChange={(e) => { setBarangayFilter(e.target.value); setPurokFilter(''); setMasterPage(1); }}
          className="bg-slate-50 border border-slate-200 text-slate-600 rounded-lg py-2 px-1 focus:outline-none cursor-pointer"
        >
          <option value="">All Barangay Sectors</option>
          {listBarangays.map((b, i) => (
            <option key={i} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={purokFilter}
          onChange={(e) => { setPurokFilter(e.target.value); setMasterPage(1); }}
          className="bg-slate-50 border border-slate-200 text-slate-600 rounded-lg py-2 px-1 focus:outline-none cursor-pointer"
        >
          <option value="">All Purok Sectors</option>
          {listPuroks.map((p, i) => (
            <option key={i} value={p}>{p}</option>
          ))}
        </select>

        <span className="text-[10px] text-slate-400 font-mono">Matched results: <strong>{filtered.length} individuals</strong></span>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-blue-600 border-r-transparent mr-2"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          No records matching selected criteria found in the masterlist database.
        </div>
      ) : (
        <>
          {/* Card list view for mobile screens */}
          <div className="block md:hidden divide-y divide-slate-100 bg-white rounded-xl border border-slate-100 overflow-hidden">
            {paginatedData.map((item, idx) => (
              <div key={idx} className="p-4 space-y-3 hover:bg-slate-50/40 transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-[12.5px] truncate">{item.fullName}</h3>
                    <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Address: {item.address} (Barangay {item.barangay}, Purok {item.purok})</span>
                  </div>
                  <span className="px-2 py-0.5 text-[8.5px] bg-sky-50 border border-sky-100 text-sky-850 font-bold rounded shrink-0">
                    {item.role || 'Member'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">Recorded By</span>
                    <span className="font-bold text-slate-700">{item.recordedBy}</span>
                  </div>
                  <div>
                    <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-extrabold">Demographics</span>
                    <span className="font-bold text-slate-700">{item.gender} • {item.age} yrs</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <span>Added: {item.dateAdded}</span>
                  <button
                    onClick={() => handleViewDossier(item)}
                    className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-750 font-bold rounded border border-blue-150 transition duration-150 cursor-pointer text-[9px] uppercase tracking-wider flex items-center gap-1 shrink-0"
                  >
                    <Eye className="h-3 w-3" /> Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Standard grid/table view for desktop screens */}
          <div className="hidden md:block overflow-x-auto rounded border border-slate-100">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-150 bg-slate-50 h-10 text-[10px] uppercase font-semibold text-slate-500">
                  <th className="py-2 pl-4">Full Name</th>
                  <th className="py-2">Structure Hierarchy Role</th>
                  <th className="py-2">Gender</th>
                  <th className="py-2">Age</th>
                  <th className="py-2">Complete residential address</th>
                  <th className="py-2">Recorded by officer</th>
                  <th className="py-2 text-right">Date added</th>
                  <th className="py-2 pr-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 transition duration-150">
                    <td className="py-3 pl-4 font-bold text-slate-800 text-[12px]">{item.fullName}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-[9px] bg-sky-50 border border-sky-100 text-sky-800 font-bold rounded">
                        {item.role || 'Member'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-500 font-mono">{item.gender}</td>
                    <td className="py-3 text-slate-700 font-semibold">{item.age} yrs</td>
                    <td className="py-3 text-slate-500">{item.address}</td>
                    <td className="py-3 text-slate-400 font-medium">{item.recordedBy}</td>
                    <td className="py-3 text-right font-mono text-slate-450">{item.dateAdded}</td>
                    <td className="py-3 pr-4 text-center">
                      <button
                        onClick={() => handleViewDossier(item)}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-770 font-bold rounded border border-blue-200 transition duration-150 cursor-pointer text-[10px] flex items-center justify-center gap-1 mx-auto"
                      >
                        <Eye className="h-3 w-3" /> View Full Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Masterlist pagination controls */}
      {totalMasterPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-100 shadow-sm mt-4 font-sans text-xs">
          <span className="text-[10px] font-medium text-slate-500 font-sans">
            Showing <span className="font-bold text-slate-800">{(activeMasterPage - 1) * masterPageSize + 1}-{Math.min(filtered.length, activeMasterPage * masterPageSize)}</span> of <span className="font-bold text-slate-800">{filtered.length}</span> citizen listings
          </span>
          
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={activeMasterPage === 1}
              onClick={() => setMasterPage(prev => Math.max(1, prev - 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            {Array.from({ length: totalMasterPages }).map((_, i) => {
              const pageNum = i + 1;
              const isCurrent = pageNum === activeMasterPage;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setMasterPage(pageNum)}
                  className={`min-w-7 h-7 flex items-center justify-center text-[11px] font-black rounded-lg border transition cursor-pointer ${
                    isCurrent 
                      ? 'bg-blue-600 font-extrabold border-blue-600 text-white shadow-xs' 
                      : 'border-slate-200 text-slate-500 hover:text-slate-850 hover:bg-slate-50 bg-white'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              disabled={activeMasterPage === totalMasterPages}
              onClick={() => setMasterPage(prev => Math.min(totalMasterPages, prev + 1))}
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition text-slate-500 disabled:opacity-40 disabled:cursor-not-allowed hover:text-slate-850 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Citizen Details Interactive Popover Backdrop */}
      {selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[10010] p-4 text-xs font-sans">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative animate-fade-in max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 block">{selectedItem.role || 'Member'}</span>
                <h3 className="text-base font-black text-slate-900">{selectedItem.fullName}</h3>
              </div>
              <button 
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-lg bg-slate-100 hover:bg-slate-200 h-8 w-8 rounded-full flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedItem.isLoadingDetails ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-slate-500 font-black text-center">Retrieving Citizen Profile Records...</p>
                <p className="text-[10px] text-slate-400 text-center">Ensuring latest clinical attachments check...</p>
              </div>
            ) : (
              <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Box 1: Core Details */}
              <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <h4 className="font-bold text-slate-800 border-b pb-1 flex items-center gap-1">👤 Resident Demographics</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-450 block font-medium">Age status</span>
                    <strong className="text-slate-800">{selectedItem.age} Years Old</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 block font-medium">Gender/Sex</span>
                    <strong className="text-slate-800">{selectedItem.gender}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 block font-medium">Barangay Sector</span>
                    <strong className="text-slate-800">{selectedItem.barangay}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 block font-medium">Purok Sector</span>
                    <strong className="text-slate-800">{selectedItem.purok}</strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-450 block font-medium">Complete Residential Address</span>
                    <strong className="text-slate-800 leading-tight block mt-0.5">{selectedItem.address}</strong>
                  </div>
                </div>
              </div>

              {/* Box 2: Metadata & Signature */}
              <div className="space-y-2.5 p-3.5 bg-slate-50 rounded-xl border border-slate-150">
                <h4 className="font-bold text-slate-800 border-b pb-1 flex items-center gap-1">📋 Enrollment Logs</h4>
                <div className="space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-450 font-medium">Recorded By:</span>
                    <strong className="text-slate-750 ml-1">{selectedItem.recordedBy}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">Date Uploaded:</span>
                    <strong className="text-slate-750 ml-1">{selectedItem.dateAdded}</strong>
                  </div>
                </div>

                {/* Patient Signature stamp */}
                <div className="pt-2 border-t text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Affixed Sworn Signature / Thumb Mark</span>
                  {selectedItem.patientSignature ? (
                    <div className="bg-white border rounded-lg p-2 flex justify-center shadow-inner h-20 max-h-20 overflow-hidden relative group">
                      <img 
                        src={selectedItem.patientSignature} 
                        className="max-h-16 w-auto object-contain" 
                        alt="Signature Seal" 
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : (
                    <span className="text-[9px] text-slate-400 block py-3 border border-dashed rounded-lg bg-white font-mono uppercase tracking-wider leading-none">NO SIGNATURE REGISTERED</span>
                  )}
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="p-4 border border-dashed border-blue-200 bg-blue-50/40 rounded-xl space-y-2.5">
              <h4 className="font-extrabold text-blue-900 text-xs flex items-center gap-1">
                📎 Linked Attachments & Enclosure Files ({selectedItem.attachments?.length || 0})
              </h4>
              {selectedItem.attachments && selectedItem.attachments.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedItem.attachments.map((img: any, index: number) => {
                    const isObj = img && typeof img === 'object';
                    const fileData = isObj ? img.fileData : img;
                    const cleanName = isObj ? (img.fileName || img.fullName || `Household_Enclosure_${index + 1}`) : `Household_Enclosure_${index + 1}`;
                    const isImg = fileData && typeof fileData === 'string' && (fileData.match(/\.(jpeg|jpg|gif|png|svg|webp)/i) || fileData.startsWith('data:image'));
                    
                    return (
                      <a
                        key={index}
                        href={fileData}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white border rounded-lg p-2.5 flex flex-col items-center justify-between text-center gap-2 shadow-sm hover:border-blue-500 hover:text-blue-700 transition cursor-pointer hover:shadow"
                      >
                        {isImg ? (
                          <div className="h-12 w-full flex items-center justify-center overflow-hidden rounded border bg-slate-50">
                            <img src={fileData} className="h-12 max-h-12 w-auto object-contain" alt="Scan document" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded bg-indigo-50 flex items-center justify-center text-blue-600 font-extrabold text-[10px] uppercase tracking-tight border border-blue-100">PDF</div>
                        )}
                        <span className="text-[9px] font-bold text-slate-700 truncate max-w-full leading-none">{cleanName}</span>
                        <span className="text-[8.5px] bg-blue-50 text-blue-800 font-black px-1.5 py-0.5 rounded uppercase leading-none border border-blue-200/55 hover:bg-blue-100">View ⭳</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-slate-450 italic pl-1 leading-none">No physical attachment documents (Valid IDs, PMS certs, PMRF scans) enclosed for this household.</p>
              )}
            </div>

            {/* Form Profiles integration indices */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1">✨ Profiling Completeness Indexes</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                <div className={`p-2 rounded-xl border ${selectedItem.pmrfDetails ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-150 text-slate-400'}`}>
                  <div className="font-bold">PMRF FORM</div>
                  <div className="font-mono text-[9px] mt-0.5 font-bold">{selectedItem.pmrfDetails ? '✅ ENROLLED' : '❌ NOT FILED'}</div>
                </div>
                <div className={`p-2 rounded-xl border ${selectedItem.fpeDetails ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-150 text-slate-400'}`}>
                  <div className="font-bold">FPE FORM</div>
                  <div className="font-mono text-[9px] mt-0.5 font-bold">{selectedItem.fpeDetails ? '✅ ENROLLED' : '❌ NOT FILED'}</div>
                </div>
                <div className={`p-2 rounded-xl border ${selectedItem.pcsfDetails ? 'bg-indigo-50/50 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-150 text-slate-400'}`}>
                  <div className="font-bold">PCSF FORM</div>
                  <div className="font-mono text-[9px] mt-0.5 font-bold">{selectedItem.pcsfDetails ? '✅ ENROLLED' : '❌ NOT FILED'}</div>
                </div>
              </div>
            </div>

            {selectedItem.notes && (
              <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-amber-900 text-[10px]">
                <strong className="font-extrabold uppercase">Field Officers Remark/Note:</strong> {selectedItem.notes}
              </div>
            )}

            <div className="flex justify-end pt-2 border-t text-[11px]">
              <button 
                onClick={() => setSelectedItem(null)}
                className="btn-3d-secondary px-4 py-1.5 font-extrabold cursor-pointer"
              >
                Close Citizen Dossier
              </button>
            </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

