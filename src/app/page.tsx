"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  FileCode2, 
  CreditCard,
  Send,
  Code
} from "lucide-react";

interface Account {
  id: string;
  account_number: string;
  account_name: string;
  account_type: string;
  currency: string;
}

interface UnderwritingData {
  vendor_account_id: string;
  vendor_account_number: string;
  vendor_name: string;
  historical_settled_volume: string;
  current_ledger_balance: string;
  dscr_coverage_ratio: number;
  cash_velocity_index: number;
  credit_risk_tier: string;
  eligible_revolving_wc_limit: string;
  max_recommended_loan_tenure_days: number;
  underwriting_verdict: string;
}

export default function TreasuryDashboard() {
  const API_BASE = "https://b2b-virtual-account-engine.onrender.com/api/v1";
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [underwriting, setUnderwriting] = useState<UnderwritingData | null>(null);
  const [reconReport, setReconReport] = useState<any>(null);
  const [camtXml, setCamtXml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [payoutAmount, setPayoutAmount] = useState("5000.00");
  const [beneficiaryName, setBeneficiaryName] = useState("Alpha Enterprises Pvt Ltd");
  const [beneficiaryAcc, setBeneficiaryAcc] = useState("50100482910291");
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState("HDFC0000060");
  const [payoutResult, setPayoutResult] = useState<any>(null);

  const updateXmlTemplate = (van: string) => {
    setCamtXml(
      `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">\n  <BkToCstmrStmt>\n    <Stmt>\n      <Ntry>\n        <Amt>15000.00</Amt>\n        <NtryDtls>\n          <TxDtls>\n            <Refs><EndToEndId>UTR_CAMT_DEMO_909</EndToEndId></Refs>\n            <RltdPties><CdtrAcct><Id><Othr><Id>${van}</Id></Othr></Id></CdtrAcct></RltdPties>\n          </TxDtls>\n        </NtryDtls>\n      </Ntry>\n    </Stmt>\n  </BkToCstmrStmt>\n</Document>`
    );
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
        const firstVendor = data.find((a: Account) => a.account_type === "VENDOR_VIRTUAL") || data[0];
        setSelectedVendorId(firstVendor.id);
        updateXmlTemplate(firstVendor.account_number);
        fetchUnderwriting(firstVendor.id);
      }
    } catch (err) {
      console.error("Failed to load accounts", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnderwriting = async (vendorId: string) => {
    if (!vendorId) return;
    try {
      const res = await fetch(`${API_BASE}/underwriting/credit-assessment/${vendorId}`);
      const data = await res.json();
      setUnderwriting(data);
    } catch (err) {
      console.error("Underwriting fetch error", err);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleSelectVendor = (acc: Account) => {
    setSelectedVendorId(acc.id);
    updateXmlTemplate(acc.account_number);
    fetchUnderwriting(acc.id);
  };

  const runCamtRecon = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/reconciliation/camt053-statement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement_batch_id: `CAMT_BATCH_${Date.now()}`,
          xml_payload: camtXml
        })
      });
      const report = await res.json();
      setReconReport(report);
    } catch (err) {
      console.error("Recon error", err);
    } finally {
      setLoading(false);
    }
  };

  const triggerAutoHeal = async (breakItem: any) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reconciliation/auto-heal-break`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utr_reference: breakItem.utr_reference,
          virtual_account_number: breakItem.virtual_account_number,
          cleared_amount: breakItem.statement_amount,
          take_rate_percentage: 10.0,
          override_reason: "DASHBOARD_1_CLICK_HEAL"
        })
      });
      const result = await res.json();
      if (res.ok) {
        setActionMessage(`Break ${breakItem.utr_reference} healed successfully!`);
        runCamtRecon();
        fetchAccounts();
      } else {
        setActionMessage(`Error: ${result.detail}`);
      }
    } catch (err) {
      console.error("Heal error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisbursePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) return;
    setLoading(true);
    setPayoutResult(null);
    setActionMessage(null);
    try {
      const res = await fetch(`${API_BASE}/payouts/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_account_id: selectedVendorId,
          amount: parseFloat(payoutAmount),
          beneficiary_name: beneficiaryName,
          beneficiary_account_number: beneficiaryAcc,
          beneficiary_ifsc: beneficiaryIfsc,
          payout_rail: "IMPS"
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPayoutResult(data);
        setActionMessage(`Payout of ₹${payoutAmount} dispatched successfully via ISO 20022!`);
        fetchUnderwriting(selectedVendorId);
      } else {
        setActionMessage(`Payout Failed: ${data.detail}`);
      }
    } catch (err) {
      console.error("Payout error", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              B2B Daylight Treasury & Ledger Portal
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Section 25 Compliant Escrow Core | ISO 20022 Rails | Automated Credit Underwriting
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAccounts}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition border border-slate-700 disabled:opacity-50"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 
            {loading ? "Syncing..." : "Refresh Node"}
          </button>
        </div>
      </header>

      {actionMessage && (
        <div className="my-4 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {actionMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        
        {/* Nodal Directory */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-sky-400" /> Nodal & Sub-Ledger Directory
          </h2>
          <div className="space-y-3 max-h-[380px] overflow-y-auto">
            {accounts.length > 0 ? (
              accounts.map((acc) => (
                <div 
                  key={acc.id} 
                  onClick={() => handleSelectVendor(acc)}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    selectedVendorId === acc.id 
                      ? "bg-slate-800 border-sky-500 ring-1 ring-sky-500" 
                      : "bg-slate-950/50 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-200">{acc.account_name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">
                      {acc.account_type}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1 truncate">
                    {acc.account_number}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 py-8 text-center">
                {loading ? "Connecting to Ledger Node..." : "No accounts found. Click Refresh Node."}
              </div>
            )}
          </div>
        </div>

        {/* Credit Underwriting Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-emerald-400" /> Stage 4 Underwriting & Credit Line
          </h2>

          {underwriting ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Sanctioned Revolver Line</div>
                <div className="text-3xl font-extrabold text-emerald-400 mt-1">
                  ₹{Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-300">
                    {underwriting.credit_risk_tier}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">DSCR Coverage</div>
                  <div className="text-lg font-bold text-sky-400">{underwriting.dscr_coverage_ratio}x</div>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <div className="text-[11px] text-slate-400">Velocity Index</div>
                  <div className="text-lg font-bold text-sky-400">{underwriting.cash_velocity_index}x</div>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                <div className="text-[11px] text-slate-400">Risk Assessment Verdict</div>
                <div className="text-xs text-slate-200 mt-1 leading-relaxed">
                  {underwriting.underwriting_verdict}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-8 text-center">Select a vendor account to evaluate risk.</div>
          )}
        </div>

        {/* CAMT.053 Reconciliation */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
            <FileCode2 className="w-4 h-4 text-purple-400" /> Stage 6: ISO 20022 Bank Statement Recon
          </h2>

          <textarea 
            value={camtXml}
            onChange={(e) => setCamtXml(e.target.value)}
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-slate-300 focus:outline-none focus:border-purple-500"
            placeholder="Paste ISO 20022 camt.053 XML..."
          />

          <button 
            onClick={runCamtRecon}
            disabled={loading || !camtXml}
            className="w-full mt-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg font-semibold text-xs transition"
          >
            {loading ? "Reconciling Engine..." : "Ingest & Reconcile CAMT.053"}
          </button>

          {reconReport && (
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Recon Match Rate:</span>
                <span className="text-xs font-bold text-emerald-400">{reconReport.reconciliation_rate_percent}%</span>
              </div>

              {reconReport.ledger_breaks && reconReport.ledger_breaks.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Ledger Breaks Detected ({reconReport.breaks_count})
                  </div>
                  {reconReport.ledger_breaks.map((brk: any, idx: number) => (
                    <div key={idx} className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="font-mono text-slate-200">{brk.utr_reference}</span>
                        <span className="font-bold text-rose-300">₹{brk.statement_amount}</span>
                      </div>
                      <button 
                        onClick={() => triggerAutoHeal(brk)}
                        className="w-full py-1 bg-rose-600 hover:bg-rose-500 text-[11px] font-semibold rounded transition"
                      >
                        1-Click Auto-Heal Break
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Outward Payout Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-cyan-400" /> Stage 3 Outward Payout Disburse (ISO 20022 pain.001)
          </h2>
          <form onSubmit={handleDisbursePayout} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Amount (INR)</label>
                <input 
                  type="number" 
                  value={payoutAmount} 
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">Beneficiary Name</label>
                <input 
                  type="text" 
                  value={beneficiaryName} 
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400">Account Number</label>
                <input 
                  type="text" 
                  value={beneficiaryAcc} 
                  onChange={(e) => setBeneficiaryAcc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400">IFSC Code</label>
                <input 
                  type="text" 
                  value={beneficiaryIfsc} 
                  onChange={(e) => setBeneficiaryIfsc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loading || !selectedVendorId}
              className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 rounded-lg font-semibold text-xs transition"
            >
              Execute Outward Payout & Generate Wire Payload
            </button>
          </form>
        </div>

        {/* pain.001 Live Payload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-2 mb-4">
            <Code className="w-4 h-4 text-amber-400" /> Generated pain.001.001.09 Wire Payload
          </h2>
          {payoutResult ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Message ID: <span className="font-mono text-amber-400">{payoutResult.iso20022_message_id}</span></span>
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-600 text-emerald-400 font-mono text-[10px]">{payoutResult.status}</span>
              </div>
              <pre className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-[160px]">
                {payoutResult.iso20022_xml_payload}
              </pre>
            </div>
          ) : (
            <div className="text-xs text-slate-500 py-12 text-center">
              Execute an outward payout above to inspect the ISO 20022 pain.001 payment instruction payload.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
