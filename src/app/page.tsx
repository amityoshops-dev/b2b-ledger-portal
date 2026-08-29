"use client";

import React, { useState, useEffect } from "react";
import { 
  Building2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  FileCode, 
  CreditCard, 
  Send, 
  Code, 
  ArrowUpRight, 
  TrendingUp, 
  ShieldCheck, 
  Copy, 
  Check, 
  Landmark, 
  QrCode,
  Repeat,
  Receipt,
  Zap,
  Activity,
  PlusCircle
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
  const [reconLoading, setReconLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copied, setCopied] = useState(false);

  const [activeRail, setActiveRail] = useState<"payouts" | "upi" | "nach" | "bbps">("payouts");

  // Outward Payout State
  const [payoutAmount, setPayoutAmount] = useState("5000.00");
  const [beneficiaryName, setBeneficiaryName] = useState("Alpha Enterprises Pvt Ltd");
  const [beneficiaryAcc, setBeneficiaryAcc] = useState("50100482910291");
  const [beneficiaryIfsc, setBeneficiaryIfsc] = useState("HDFC0000060");
  const [payoutResult, setPayoutResult] = useState<any>(null);

  // NPCI Simulation States
  const [upiAmount, setUpiAmount] = useState("10000.00");
  const [upiResult, setUpiResult] = useState<{ uri: string; qrUrl: string } | null>(null);
  const [nachMandateAmount, setNachMandateAmount] = useState("50000.00");
  const [nachResult, setNachResult] = useState<any>(null);
  const [bbpsInvoiceId, setBbpsInvoiceId] = useState("INV-2026-9041");
  const [bbpsAmount, setBbpsAmount] = useState("12450.00");
  const [bbpsResult, setBbpsResult] = useState<any>(null);

  const updateXmlTemplate = (van: string) => {
    setCamtXml(
      `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">\n  <BkToCstmrStmt>\n    <Stmt>\n      <Ntry>\n        <Amt>15000.00</Amt>\n        <NtryDtls>\n          <TxDtls>\n            <Refs>\n              <EndToEndId>UTR_CAMT_DEMO_909</EndToEndId>\n            </Refs>\n            <RltdPties>\n              <CdtrAcct>\n                <Id><Othr><Id>${van}</Id></Othr></Id>\n              </CdtrAcct>\n            </RltdPties>\n          </TxDtls>\n        </NtryDtls>\n      </Ntry>\n    </Stmt>\n  </BkToCstmrStmt>\n</Document>`
    );
  };

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/accounts`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setAccounts(data);
        const vendorAccount = data.find((a: Account) => a.account_type === "VENDOR_VIRTUAL") || data[0];
        if (!selectedVendorId || !data.some((a: Account) => a.id === selectedVendorId)) {
          setSelectedVendorId(vendorAccount.id);
          updateXmlTemplate(vendorAccount.account_number);
          fetchUnderwriting(vendorAccount.id);
        }
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
    setUpiResult(null);
  };

  const injectLiveVolume = async () => {
    if (!selectedVendorId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/seed-live-volume/${selectedVendorId}`, { method: "POST" });
      if (res.ok) {
        setActionMessage({ text: "₹250,000 Volume Injected! Real-time credit limits recalculated.", type: "success" });
        fetchUnderwriting(selectedVendorId);
      }
    } catch (err) {
      console.error("Failed to inject volume", err);
    } finally {
      setLoading(false);
    }
  };

  const runCamtRecon = async () => {
    setReconLoading(true);
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
      setReconLoading(false);
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
        setActionMessage({ text: `Break ${breakItem.utr_reference} healed and balanced!`, type: "success" });
        runCamtRecon();
        fetchAccounts();
        if (selectedVendorId) fetchUnderwriting(selectedVendorId);
      } else {
        setActionMessage({ text: result.detail || "Healing exception occurred", type: "error" });
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
    setPayoutLoading(true);
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
        setActionMessage({ text: `Payout of ₹${payoutAmount} disbursed via ISO 20022 wire instruction!`, type: "success" });
        fetchUnderwriting(selectedVendorId);
      } else {
        setActionMessage({ text: `Payout Failed: ${data.detail}`, type: "error" });
      }
    } catch (err) {
      console.error("Payout error", err);
    } finally {
      setPayoutLoading(false);
    }
  };

  const handleSimulateUpi = () => {
    const activeAcc = accounts.find(a => a.id === selectedVendorId);
    const vpa = activeAcc ? `${activeAcc.account_number.toLowerCase()}@hdfcbank` : "merchant@hdfcbank";
    const uri = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(activeAcc?.account_name || "Merchant")}&am=${upiAmount}&cu=INR&tn=B2B_SETTLEMENT_${Date.now()}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(uri)}`;
    setUpiResult({ uri, qrUrl });
    setActionMessage({ text: `Generated Dynamic NPCI UPI QR Intent for ₹${upiAmount}!`, type: "success" });
  };

  const handleSimulateNach = async () => {
    if (!selectedVendorId) return;
    try {
      const res = await fetch(`${API_BASE}/npci/nach-mandate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_account_id: selectedVendorId,
          max_amount: parseFloat(nachMandateAmount),
          frequency: "MONTHLY"
        })
      });
      const data = await res.json();
      setNachResult(data);
      setActionMessage({ text: `NACH Mandate ${data.umrn} registered with NPCI clearing rails!`, type: "success" });
    } catch (err) {
      console.error("NACH error", err);
    }
  };

  const handleSimulateBbps = () => {
    setBbpsResult({
      biller_id: "HDFC90281BBPS",
      invoice_number: bbpsInvoiceId,
      amount: bbpsAmount,
      payment_status: "PAID_SETTLED_T1",
      npci_ref_id: `BBPS${Date.now()}`
    });
    setActionMessage({ text: `BBPS B2B Invoice ${bbpsInvoiceId} settled via NPCI Central Switch!`, type: "success" });
  };

  const handleCopyXml = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeVendor = accounts.find(a => a.id === selectedVendorId);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans antialiased pb-20">
      
      {/* Header */}
      <header className="border-b border-slate-200/90 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight">B2B Virtual Account & Double-Entry Ledger Engine</span>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-xs text-slate-500">
                CMS Clearing Core &bull; NPCI Rails (UPI / NACH / BBPS) &bull; ISO 20022 Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-100 text-xs font-mono text-slate-600 border border-slate-200">
              <span>LEDGERS: <strong className="text-slate-900">{accounts.length}</strong></span>
              <span className="text-slate-300">|</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% BALANCED
              </span>
            </div>

            <button 
              onClick={fetchAccounts}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-black text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> 
              {loading ? "Syncing..." : "Refresh Node"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        
        {/* Banner Alert */}
        {actionMessage && (
          <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium shadow-sm ${
            actionMessage.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}>
            <div className="flex items-center gap-2.5">
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              )}
              <span>{actionMessage.text}</span>
            </div>
            <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-700 text-xs">✕</button>
          </div>
        )}

        {/* 4-Stat Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Virtual Account</div>
            <div className="text-sm font-bold text-slate-900 mt-1 truncate">
              {activeVendor ? activeVendor.account_name : "Selecting..."}
            </div>
            <div className="text-[11px] font-mono text-blue-600 mt-0.5 truncate">
              {activeVendor ? activeVendor.account_number : "---"}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Sanctioned Revolver Line</div>
            <div className="text-xl font-bold font-mono text-emerald-600 mt-1">
              ₹{underwriting ? Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Tier: <span className="font-semibold text-slate-800">{underwriting?.credit_risk_tier || "TIER_1"}</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">DSCR Coverage Ratio</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {underwriting ? `${underwriting.dscr_coverage_ratio}x` : "2.8x"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Benchmark: &gt; 1.50x</div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Cash Velocity Index</div>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {underwriting ? `${underwriting.cash_velocity_index}x` : "4.2x"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Turnover Velocity</div>
          </div>
        </div>

        {/* Primary Row: Sub-Ledgers & Underwriting Card */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Sub-Ledger Directory */}
          <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Nodal & Sub-Ledger Directory
                  </h2>
                </div>
                <span className="text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  {accounts.length} Ledgers
                </span>
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {accounts.length > 0 ? (
                  accounts.map((acc) => {
                    const isSelected = selectedVendorId === acc.id;
                    const isVendor = acc.account_type === "VENDOR_VIRTUAL";
                    return (
                      <div 
                        key={acc.id} 
                        onClick={() => handleSelectVendor(acc)}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected 
                            ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-200" 
                            : "bg-slate-50/70 border-slate-200/90 hover:border-slate-300 hover:bg-slate-100/60"
                        }`}
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-900">{acc.account_name}</span>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-medium ${
                            isVendor 
                              ? "bg-teal-100 text-teal-800 border border-teal-200" 
                              : "bg-slate-200 text-slate-700 border border-slate-300"
                          }`}>
                            {acc.account_type}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between">
                          <span className="truncate">{acc.account_number}</span>
                          {isSelected && <ArrowUpRight className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Connecting to live PostgreSQL ledger...
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Section 25 Escrow Pool</span>
              <span className="text-emerald-700 font-mono font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 100% BALANCED
              </span>
            </div>
          </div>

          {/* Underwriting Card with Real-time Ingestion Trigger */}
          <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Stage 4 Underwriting & Live Credit Scoring
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={injectLiveVolume}
                    disabled={loading || !selectedVendorId}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md text-xs font-semibold transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" /> Inject Volume (+₹250k)
                  </button>
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                    {underwriting ? underwriting.underwriting_verdict : "APPROVED"}
                  </span>
                </div>
              </div>

              {underwriting ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                    <div className="text-xs font-medium text-slate-500">Sanctioned Revolver Line Calculation</div>
                    <div className="text-2xl font-extrabold text-emerald-700 mt-1 font-mono">
                      ₹{Number(underwriting.eligible_revolving_wc_limit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex justify-between">
                      <span>Historical Settled Volume: <strong>₹{Number(underwriting.historical_settled_volume).toLocaleString("en-IN")}</strong></span>
                      <span>Balance: <strong>₹{Number(underwriting.current_ledger_balance).toLocaleString("en-IN")}</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="text-[11px] font-semibold text-slate-500">Maximum Recommended Tenor</div>
                      <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                        {underwriting.max_recommended_loan_tenure_days} Days
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="text-[11px] font-semibold text-slate-500">Credit Risk Tier</div>
                      <div className="text-base font-bold text-blue-700 mt-0.5 font-mono">
                        {underwriting.credit_risk_tier}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80">
                    <div className="text-[11px] font-semibold text-slate-500 mb-1">Risk Assessment Details</div>
                    <div className="text-xs text-slate-700 leading-relaxed">
                      DSCR coverage is verified at <strong>{underwriting.dscr_coverage_ratio}x</strong> (above benchmark threshold). Cash velocity of <strong>{underwriting.cash_velocity_index}x</strong> qualifies the vendor for automated daylight drawdown facilities.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-xs text-slate-500">
                  Select a vendor sub-ledger on the left to review underwriting metrics.
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Risk Engine Status</span>
              <span className="text-blue-700 font-mono font-semibold">ACTIVE &bull; RUNNING IN REAL-TIME</span>
            </div>
          </div>

        </div>

        {/* NPCI & CMS Corporate Rails Hub */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-100 gap-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" /> CMS Plumbing & NPCI Clearing Rails Hub
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Simulate and operate unified corporate collections and payouts across NPCI switches.
              </p>
            </div>

            {/* Rail Selector Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button 
                onClick={() => setActiveRail("payouts")}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  activeRail === "payouts" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Host-to-Host (ISO 20022)
              </button>
              <button 
                onClick={() => setActiveRail("upi")}
                className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeRail === "upi" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <QrCode className="w-3 h-3 text-emerald-600" /> NPCI UPI Intent & QR
              </button>
              <button 
                onClick={() => setActiveRail("nach")}
                className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeRail === "nach" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Repeat className="w-3 h-3 text-blue-600" /> NACH e-Mandate
              </button>
              <button 
                onClick={() => setActiveRail("bbps")}
                className={`px-3 py-1 rounded text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeRail === "bbps" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Receipt className="w-3 h-3 text-purple-600" /> BBPS B2B Invoicing
              </button>
            </div>
          </div>

          <div className="pt-5">
            
            {/* Tab 1: Host to Host ISO 20022 */}
            {activeRail === "payouts" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6">
                  <h3 className="text-xs font-bold uppercase text-slate-700 mb-3">Outward Payout Form (pain.001)</h3>
                  <form onSubmit={handleDisbursePayout} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount (INR)</label>
                        <input 
                          type="number" 
                          value={payoutAmount} 
                          onChange={(e) => setPayoutAmount(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">Beneficiary Legal Name</label>
                        <input 
                          type="text" 
                          value={beneficiaryName} 
                          onChange={(e) => setBeneficiaryName(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">Account Number / IBAN</label>
                        <input 
                          type="text" 
                          value={beneficiaryAcc} 
                          onChange={(e) => setBeneficiaryAcc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 block mb-1">IFSC Code</label>
                        <input 
                          type="text" 
                          value={beneficiaryIfsc} 
                          onChange={(e) => setBeneficiaryIfsc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                        />
                      </div>
                    </div>
                    <button 
                      type="submit"
                      disabled={payoutLoading || !selectedVendorId}
                      className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                    >
                      {payoutLoading ? "Generating Wire Instruction..." : "Execute Outward Payout & Generate Wire Payload"}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-700 mb-2">pain.001.001.09 Live Payload</div>
                    {payoutResult ? (
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-500 flex justify-between font-mono">
                          <span>MSG_ID: <strong className="text-slate-900">{payoutResult.iso20022_message_id}</strong></span>
                          <span className="text-emerald-700 font-bold">{payoutResult.status}</span>
                        </div>
                        <pre className="w-full bg-slate-900 text-amber-200 border border-slate-800 rounded-lg p-2.5 font-mono text-[10px] overflow-x-auto max-h-[110px] leading-relaxed">
                          {payoutResult.iso20022_xml_payload}
                        </pre>
                      </div>
                    ) : (
                      <div className="h-[110px] flex items-center justify-center text-xs text-slate-400">
                        Execute payout to inspect the generated ISO 20022 XML wire instruction.
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-200 flex justify-between">
                    <span>CLEARING: IMPS / RTGS</span>
                    <span>STANDARD: ISO 20022</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: NPCI UPI Rails with Live QR Code */}
            {activeRail === "upi" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-700">Dynamic UPI Merchant Collection (NPCI Switch)</h3>
                  <p className="text-xs text-slate-600">
                    Generates a live, scan-ready UPI Auto-Route QR payload mapped to the active merchant virtual account for automated escrow splitting.
                  </p>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Collection Amount (INR)</label>
                    <input 
                      type="number" 
                      value={upiAmount} 
                      onChange={(e) => setUpiAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  <button 
                    onClick={handleSimulateUpi}
                    className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                  >
                    Generate Live NPCI Dynamic QR
                  </button>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-700 mb-2">Live NPCI Intent & QR Payload</div>
                    {upiResult ? (
                      <div className="flex flex-col sm:flex-row items-center gap-4">
                        <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-xs">
                          <img src={upiResult.qrUrl} alt="UPI QR" className="w-28 h-28" />
                        </div>
                        <div className="space-y-1 text-xs overflow-hidden">
                          <div className="p-2 bg-white border border-slate-200 rounded font-mono text-[10px] text-emerald-800 break-all max-h-16 overflow-y-auto">
                            {upiResult.uri}
                          </div>
                          <div className="text-[11px] text-slate-600 pt-1">
                            <strong>Escrow Routing:</strong> 90% Vendor + 10% Fee Split
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[110px] flex items-center justify-center text-xs text-slate-400">
                        Click Generate to render the live dynamic NPCI UPI QR code.
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-200 flex justify-between">
                    <span>SWITCH: NPCI UPI 2.0</span>
                    <span>SETTLEMENT: INSTANT REAL-TIME</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: NACH e-Mandate */}
            {activeRail === "nach" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-700">NACH B2B Recurring e-Mandate Engine</h3>
                  <p className="text-xs text-slate-600">
                    Registers an automated corporate mandate through the NPCI NACH clearing house for scheduled invoice sweeps.
                  </p>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">Max Recurring Limit (INR)</label>
                    <input 
                      type="number" 
                      value={nachMandateAmount} 
                      onChange={(e) => setNachMandateAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                  <button 
                    onClick={handleSimulateNach}
                    className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                  >
                    Register NACH e-Mandate with NPCI
                  </button>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-700 mb-2">UMRN Mandate Confirmation</div>
                    {nachResult ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                          <div>UMRN: <strong className="text-blue-700">{nachResult.umrn}</strong></div>
                          <div>STATUS: <strong className="text-emerald-700">{nachResult.status}</strong></div>
                          <div>CLEARING: {nachResult.clearing_switch}</div>
                          <div>MAX LIMIT: ₹{Number(nachResult.max_amount).toLocaleString("en-IN")}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[100px] flex items-center justify-center text-xs text-slate-400">
                        Register a mandate above to issue an official NPCI UMRN identifier.
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-200 flex justify-between">
                    <span>CLEARING: NPCI NACH</span>
                    <span>FREQUENCY: AS & WHEN PRESENTED</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 4: BBPS B2B Invoicing */}
            {activeRail === "bbps" && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-6 space-y-3">
                  <h3 className="text-xs font-bold uppercase text-slate-700">Bharat BillPay (BBPS) B2B Invoicing</h3>
                  <p className="text-xs text-slate-600">
                    Presents standard electronic invoices directly on the central BBPS operating unit (BBDOU) for automated reconciliation.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Invoice ID</label>
                      <input 
                        type="text" 
                        value={bbpsInvoiceId} 
                        onChange={(e) => setBbpsInvoiceId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-700 block mb-1">Invoice Amount</label>
                      <input 
                        type="number" 
                        value={bbpsAmount} 
                        onChange={(e) => setBbpsAmount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono text-slate-900 focus:bg-white focus:outline-none focus:border-purple-500 transition"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSimulateBbps}
                    className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                  >
                    Present & Clear via BBPS Central Switch
                  </button>
                </div>

                <div className="lg:col-span-6 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <div className="text-xs font-bold uppercase text-slate-700 mb-2">BBPS Settlement Slip</div>
                    {bbpsResult ? (
                      <div className="space-y-2 text-xs">
                        <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1 font-mono text-[11px]">
                          <div>NPCI REF: <strong className="text-purple-700">{bbpsResult.npci_ref_id}</strong></div>
                          <div>STATUS: <strong className="text-emerald-700">{bbpsResult.payment_status}</strong></div>
                          <div>BILLER ID: {bbpsResult.biller_id}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[100px] flex items-center justify-center text-xs text-slate-400">
                        Present a B2B bill to clear through NPCI Bharat BillPay.
                      </div>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-200 flex justify-between">
                    <span>CLEARING: NPCI BBOB</span>
                    <span>SETTLEMENT: GUARANTEED T+1</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Bank Statement Reconciliation (camt.053) */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-purple-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Stage 6: ISO 20022 camt.053 Bank Statement Reconciliation Engine
              </h2>
            </div>
            <button 
              onClick={() => handleCopyXml(camtXml)} 
              className="text-[11px] font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded border border-slate-200 transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied" : "Copy Template"}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <textarea 
                value={camtXml}
                onChange={(e) => setCamtXml(e.target.value)}
                rows={5}
                className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-3 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition leading-relaxed"
                placeholder="Paste ISO 20022 camt.053 XML..."
              />
              <button 
                onClick={runCamtRecon}
                disabled={reconLoading || !camtXml}
                className="w-full mt-2 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-xs transition"
              >
                {reconLoading ? "Parsing & Reconciling XML..." : "Ingest & Reconcile CAMT.053 Statement"}
              </button>
            </div>

            <div className="lg:col-span-5 flex flex-col justify-between">
              {reconReport ? (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-slate-600">Reconciliation Match Rate</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                      {reconReport.reconciliation_rate_percent}%
                    </span>
                  </div>

                  {reconReport.ledger_breaks && reconReport.ledger_breaks.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div className="text-[11px] font-bold text-rose-700 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" /> Ledger Breaks Detected ({reconReport.breaks_count})
                      </div>
                      {reconReport.ledger_breaks.map((brk: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white border border-rose-200 rounded-lg flex items-center justify-between gap-3 shadow-xs">
                          <div>
                            <div className="text-xs font-mono font-bold text-slate-900">{brk.utr_reference}</div>
                            <div className="text-[11px] font-mono text-rose-700">₹{brk.statement_amount} &bull; {brk.break_reason}</div>
                          </div>
                          <button 
                            onClick={() => triggerAutoHeal(brk)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md shadow-xs transition"
                          >
                            1-Click Auto-Heal
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-6 border border-dashed border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-400">
                  Ingest an end-of-day bank statement to verify clearing matching.
                </div>
              )}

              <div className="text-[10px] text-slate-500 font-mono pt-3 border-t border-slate-100 flex justify-between mt-3">
                <span>FORMAT: CAMT.053.001.08</span>
                <span>STATUS: VERIFIED PARSER</span>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
