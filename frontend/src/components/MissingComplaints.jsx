import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { apiClient } from "../config/api";
import "./MissingComplaints.css";
import { jsPDF } from "jspdf";
import { useData } from "../contexts/DataContext";
import {
  FileText, Search, RefreshCw, AlertTriangle, MapPin, ExternalLink,
  Phone, Calendar, Clock, Copy, Check, X, ShieldAlert
} from "lucide-react";

function formatDate(value) {
  if (!value) return "-";
  try {
    if (typeof value === "object" && value) {
      if (typeof value.toDate === "function") {
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(value.toDate());
      }
      if (typeof value.seconds === "number") {
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(new Date(value.seconds * 1000));
      }
      if (typeof value._seconds === "number") {
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(new Date(value._seconds * 1000));
      }
    }
    if (
      typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value.trim()))
    ) {
      const num = Number(value);
      const ms = num > 1e12 ? num : num * 1000;
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date(ms));
    }
    if (typeof value === "string") {
      const cleaned = value.replace(/^\s*createdAt\s*/i, "").trim();
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(d);
      }
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(d);
    }
    return "-";
  } catch {
    return "-";
  }
}

function formatUnixSecondsToLocale(seconds) {
  if (!seconds) return "N/A";
  const date = new Date(seconds * 1000);
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSecondsToHHMM(totalSeconds) {
  if (!Number.isFinite(Number(totalSeconds))) return "-";
  const secs = Math.max(0, Math.floor(Number(totalSeconds)));
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatEmergencyContactsForPDF(contacts) {
  if (!contacts) return "N/A";
  if (typeof contacts === "string") {
    try { contacts = JSON.parse(contacts); } catch { return contacts; }
  }
  if (Array.isArray(contacts)) {
    return contacts.map(c => `${c.name || "Unknown"}: ${c.phone || "No phone"}`).join("; ");
  }
  if (typeof contacts === "object" && contacts !== null) {
    return `${contacts.name || "Unknown"}: ${contacts.phone || "No phone"}`;
  }
  return "N/A";
}

function formatTripDetailsForPDF(tripDetails) {
  if (!tripDetails) return "N/A";
  if (typeof tripDetails === "string") {
    try { tripDetails = JSON.parse(tripDetails); } catch { return tripDetails; }
  }
  const details = [];
  if (tripDetails.destination) details.push(`Destination: ${tripDetails.destination}`);
  if (tripDetails.startDate) details.push(`Start: ${new Date(tripDetails.startDate).toLocaleDateString("en-IN")}`);
  if (tripDetails.returnDate) details.push(`Return: ${new Date(tripDetails.returnDate).toLocaleDateString("en-IN")}`);
  return details.length > 0 ? details.join(", ") : "N/A";
}

function formatFamilyMembersForPDF(familyMembers) {
  if (!familyMembers || !Array.isArray(familyMembers) || familyMembers.length === 0) {
    return "No family members registered";
  }
  return familyMembers
    .map((member, index) => {
      const name = member.fullName || "Unknown";
      const age = member.age ? `${member.age} years` : "Age not specified";
      const gender = member.gender || "Not specified";
      return `${index + 1}. ${name} (${age}, ${gender})`;
    })
    .join("\n");
}

function generateMissingPersonSummary(tourist, alert) {
  const touristName = tourist?.fullName || "The tourist";
  const nationality = tourist?.nationality || "Indian";
  const age = tourist?.age ? `${tourist.age} years` : "unknown age";
  const gender = tourist?.gender ? tourist.gender.toLowerCase() : "unknown gender";

  const lastKnownLocation =
    alert?.location?.latitude && alert?.location?.longitude
      ? `approximately ${alert.location.latitude}, ${alert.location.longitude}`
      : "unknown location";

  const lastSeenTime = alert?.createdAt ? formatDate(alert.createdAt) : "recently";
  const idleDuration = alert?.idleDuration ? formatSecondsToHHMM(alert.idleDuration) : "unknown period";

  const familyCount = tourist?.familyMembers?.length || 0;
  const familyInfo =
    familyCount > 0
      ? `The tourist was accompanied by ${familyCount} family member(s).`
      : "The tourist was traveling alone.";

  const destination = tourist?.tripDetails?.destination || "the local area";

  return `
${touristName}, a ${nationality} national of ${age} and ${gender}, has been reported missing through the automated tourist safety monitoring system.

INCIDENT SUMMARY:
The individual was last detected by the safety monitoring system at ${lastSeenTime} in the vicinity of ${lastKnownLocation}. The system registered unusual inactivity for a duration of ${idleDuration}, triggering an automatic missing person alert.

BACKGROUND:
${touristName} was visiting ${destination}. ${familyInfo} The digital tourist identification system (DTID: ${tourist?.dtid || "N/A"}) was actively monitoring the tourist's safety.

RECOMMENDED NEXT STEPS:
• Verify last known location with ground patrols
• Contact registered emergency contacts for additional information
• Check local hospitals and transportation hubs
• Review CCTV footage from the last known area
• Coordinate with local tourist police units
  `.trim();
}

function generateEFIRPDF(tourist, alert) {
  try {
    const doc = new jsPDF();

    // Prefer the officially filed FIR number persisted on the alert; fall back to a derived one.
    const firNo = alert?.firNo || `MIS/${alert?.id?.slice(-8)?.toUpperCase() || "N/A"}/${new Date().getFullYear()}`;

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("ELECTRONIC FIRST INFORMATION REPORT (E-FIR)", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`FIR No: ${firNo}`, 20, 35);
    doc.text(`Police Station: Cyber Crime/Tourist Missing Cell`, 20, 42);
    doc.text(`Date & Time: ${new Date().toLocaleString("en-IN")}`, 20, 49);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SECTION 1: MISSING TOURIST DETAILS", 20, 65);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    let yPosition = 75;

    const touristDetails = [
      ["Digital Tourist ID (DTID):", tourist?.dtid || "N/A"],
      ["Full Name:", tourist?.fullName || "N/A"],
      ["Nationality:", tourist?.nationality || "Indian"],
      ["Age:", tourist?.age || "N/A"],
      ["Gender:", tourist?.gender || "N/A"],
      ["Contact Number:", tourist?.phone || tourist?.mobileNumber || "N/A"],
      ["Email:", tourist?.email || "N/A"],
      ["Emergency Contacts:", formatEmergencyContactsForPDF(tourist?.emergencyContacts)],
      ["Tourist ID Issue Date:", formatUnixSecondsToLocale(tourist?.issuedAt)],
      ["Expected Return Date:", formatUnixSecondsToLocale(tourist?.returnDate || tourist?.validTill)],
    ];

    touristDetails.forEach(([label, value]) => {
      doc.text(`${label}`, 20, yPosition);
      const lines = doc.splitTextToSize(value || "N/A", 100);
      doc.text(lines, 80, yPosition);
      yPosition += lines.length * 6 + 2;
    });

    yPosition += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Family Members / Travel Companions:", 20, yPosition);

    yPosition += 8;
    doc.setFont("helvetica", "normal");
    const familyMembersText = formatFamilyMembersForPDF(tourist?.familyMembers);
    const familyLines = doc.splitTextToSize(familyMembersText, 160);
    familyLines.forEach((line) => {
      doc.text(line, 20, yPosition);
      yPosition += 6;
    });

    yPosition += 10;
    doc.setFont("helvetica", "bold");
    doc.text("SECTION 2: MISSING INCIDENT DETAILS", 20, yPosition);

    yPosition += 10;
    doc.setFont("helvetica", "normal");
    const incidentDetails = [
      ["Alert Generated:", formatDate(alert?.createdAt)],
      ["Last Known Location:", `${alert?.location?.latitude || "-"}, ${alert?.location?.longitude || "-"}`],
      ["Idle Duration:", formatSecondsToHHMM(alert?.idleDuration)],
      ["Device UID:", alert?.userId || alert?.uid || "N/A"],
      ["Trip Details:", formatTripDetailsForPDF(tourist?.tripDetails)],
    ];

    incidentDetails.forEach(([label, value]) => {
      doc.text(`${label}`, 20, yPosition);
      const lines = doc.splitTextToSize(value || "N/A", 100);
      doc.text(lines, 80, yPosition);
      yPosition += lines.length * 6 + 2;
    });

    doc.setDrawColor(0, 0, 128);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    doc.addPage();
    doc.setDrawColor(0, 0, 128);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("MISSING PERSON CASE SUMMARY", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Case Reference: ${firNo}`, 20, 35);
    doc.text(`Missing Person: ${tourist?.fullName || "N/A"}`, 20, 42);
    doc.text(`DTID: ${tourist?.dtid || "N/A"}`, 20, 49);

    const summaryText = generateMissingPersonSummary(tourist, alert);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);

    const summaryLines = doc.splitTextToSize(summaryText, 170);
    let summaryYPosition = 65;

    summaryLines.forEach((line) => {
      if (summaryYPosition > 250) {
        doc.addPage();
        summaryYPosition = 20;
      }
      doc.text(line, 20, summaryYPosition);
      summaryYPosition += 6;
    });

    const fileName = `E-FIR_Missing_${tourist?.dtid || "Tourist"}_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating E-FIR PDF. Please try again.");
  }
}

function TouristCard({ tourist, index, alert, onReportMissing }) {
  const [copied, setCopied] = useState(false);
  const [filing, setFiling] = useState(false);

  const displayTourist = tourist || {
    dtid: alert?.dtid || "N/A",
    fullName: alert?.userId ? "Registered Tourist" : "Unknown Tourist",
    phone: "N/A",
  };

  // Case status is driven by the alert itself: 'missing' once an officer confirms & files the E-FIR,
  // otherwise it is a pending idle alert awaiting manual review.
  const isMissing = alert?.status === "missing";
  const firNo = alert?.firNo;

  const handleDownloadEFIR = () => {
    generateEFIRPDF(displayTourist, alert);
  };

  const handleConfirmMissing = async () => {
    if (filing || !alert?.id || typeof onReportMissing !== "function") return;
    const ok = window.confirm(
      `Confirm ${displayTourist.fullName || "this tourist"} as MISSING and file an official E-FIR?\n\n` +
      `This creates a permanent E-FIR record in the system and cannot be undone.`
    );
    if (!ok) return;
    setFiling(true);
    try {
      await onReportMissing(alert.id);
    } catch (err) {
      console.error("Failed to file E-FIR:", err);
      window.alert("Failed to file E-FIR. Please try again.");
    } finally {
      setFiling(false);
    }
  };

  const handleCopyDtid = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(displayTourist.dtid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = (displayTourist.fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const lat = alert?.location?.latitude;
  const lng = alert?.location?.longitude;
  const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;

  return (
    <div className={`mc-efir-card fade-in ${isMissing ? "card-status-missing" : "card-status-pending"}`}>
      {/* Header Bar: Row 1 Name + Avatar + Case Tag */}
      <div className="mc-card-top-header">
        <div className="mc-avatar-circle">{initials}</div>
        <div className="mc-name-box">
          <h3 className="mc-name-text">{displayTourist.fullName || "Registered Tourist"}</h3>
          <span className="mc-case-tag">Case #{index + 1}</span>
        </div>
      </div>

      {/* Header Bar: Row 2 Dedicated Clear DTID Strip */}
      <div className="mc-dtid-dedicated-strip" onClick={handleCopyDtid} title="Click to copy DTID">
        <span className="dtid-badge">DTID</span>
        <code className="dtid-code-text">{displayTourist.dtid}</code>
        <button className="btn-copy-dtid-action" aria-label="Copy DTID">
          {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
        </button>
      </div>

      {/* Incident details box */}
      {alert && (
        <div className="mc-incident-strip">
          <div className="inc-header-row">
            <span className="inc-alert-badge">
              <AlertTriangle size={13} /> SAFETY SENSOR ALERT
            </span>
            <span className="inc-timestamp">{formatDate(alert.createdAt)}</span>
          </div>

          <div className="inc-grid-2">
            <div>
              <span className="inc-lbl">INACTIVITY PERIOD</span>
              <strong className="inc-val">
                {Number.isFinite(Number(alert.idleDuration)) ? formatSecondsToHHMM(alert.idleDuration) : "-"}
              </strong>
            </div>

            <div>
              <span className="inc-lbl">GPS COORDINATES</span>
              <strong className="inc-val mono">{lat ?? "—"}, {lng ?? "—"}</strong>
            </div>
          </div>

          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn-open-maps-link">
              <MapPin size={13} /> View on Google Maps <ExternalLink size={11} />
            </a>
          )}
        </div>
      )}

      {/* Body details */}
      <div className="mc-card-body-details">
        <div className="mc-row">
          <span className="lbl"><Phone size={13} /> Contact</span>
          <span className="val">{displayTourist.phone || displayTourist.mobileNumber || "N/A"}</span>
        </div>

        <div className="mc-row">
          <span className="lbl"><Calendar size={13} /> Issued</span>
          <span className="val">{formatUnixSecondsToLocale(displayTourist.issuedAt)}</span>
        </div>

        <div className="mc-row">
          <span className="lbl"><Clock size={13} /> Check-out</span>
          <span className="val">{formatUnixSecondsToLocale(displayTourist.returnDate || displayTourist.validTill)}</span>
        </div>

        {/* Companions */}
        {displayTourist.familyMembers && displayTourist.familyMembers.length > 0 && (
          <div className="mc-companions-block">
            <span className="comp-lbl">Travel Companions ({displayTourist.familyMembers.length})</span>
            <div className="comp-tags">
              {displayTourist.familyMembers.map((m, i) => (
                <span key={i} className="comp-tag">{m.fullName || m.name}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div className="mc-card-footer">
        <span className={`mc-status-pill ${isMissing ? "pill-missing" : "pill-pending"}`}>
          <span className="status-dot"></span>
          {isMissing ? "Reported Missing" : "Pending Review"}
        </span>

        {isMissing ? (
          <button className="btn-download-efir" onClick={handleDownloadEFIR}>
            <FileText size={14} /> Download E-FIR PDF
          </button>
        ) : (
          <button className="btn-confirm-missing" onClick={handleConfirmMissing} disabled={filing}>
            <ShieldAlert size={14} /> {filing ? "Filing E-FIR…" : "Confirm Missing & File E-FIR"}
          </button>
        )}
      </div>

      {/* Filed E-FIR reference strip (shown once an E-FIR is on record) */}
      {isMissing && firNo && (
        <div className="mc-efir-filed-badge">
          <Check size={13} /> E-FIR Filed · <span className="fir-no">{firNo}</span>
        </div>
      )}
    </div>
  );
}

const MemoTouristCard = memo(TouristCard);

export default function MissingComplaints() {
  const {
    touristsMap: globalTouristsMap,
    safetyAlerts: globalSafetyAlerts,
    loadingSafety: loading,
    fetchSafetyAlerts,
    reportMissingAndFileEfir,
    triggerRefresh
  } = useData();

  const [touristByDtid, setTouristByDtid] = useState({});
  const [query, setQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");

  const items = useMemo(() => {
    return [...(globalSafetyAlerts || [])].sort((a, b) => {
      const da = new Date(a.createdAt).getTime() || 0;
      const db = new Date(b.createdAt).getTime() || 0;
      return db - da;
    });
  }, [globalSafetyAlerts]);

  const handleRefresh = useCallback(() => {
    fetchSafetyAlerts();
    triggerRefresh();
  }, [fetchSafetyAlerts, triggerRefresh]);

  useEffect(() => {
    if (items.length === 0) return;
    const dtids = items.map((a) => a.dtid).filter(Boolean);

    let needsUpdate = false;
    const missingDtids = [];

    dtids.forEach((dtid) => {
      if (globalTouristsMap[dtid] && !touristByDtid[dtid]) {
        needsUpdate = true;
      } else if (!touristByDtid[dtid] && !globalTouristsMap[dtid]) {
        missingDtids.push(dtid);
      }
    });

    if (needsUpdate) {
      setTouristByDtid((prev) => ({ ...globalTouristsMap, ...prev }));
    }

    if (missingDtids.length === 0) return;

    let cancelled = false;
    async function loadMissing() {
      for (const dtid of missingDtids) {
        if (cancelled) break;
        try {
          const { data } = await apiClient.get(`/api/tourists/${dtid}`);
          if (!cancelled && data) {
            setTouristByDtid((prev) => ({ ...prev, [dtid]: data }));
          }
        } catch {}
      }
    }

    loadMissing();
    return () => {
      cancelled = true;
    };
  }, [items, globalTouristsMap]);

  const stats = useMemo(() => {
    let missing = 0;
    items.forEach(a => {
      if (a.status === "missing") missing++;
    });
    return { total: items.length, missing, pending: items.length - missing };
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;

    if (filterMode === "missing") {
      list = list.filter(a => a.status === "missing");
    } else if (filterMode === "pending") {
      list = list.filter(a => a.status !== "missing");
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((item) => {
        const tourist = touristByDtid[item.dtid] || globalTouristsMap[item.dtid];
        const name = String(tourist?.fullName || "").toLowerCase();
        const dtid = String(item.dtid || "").toLowerCase();
        return dtid.includes(q) || name.includes(q);
      });
    }

    return list;
  }, [items, filterMode, query, touristByDtid, globalTouristsMap]);

  return (
    <div className="mc-dashboard-wrapper fade-in">
      {/* Hero Header */}
      <div className="mc-hero-header">
        <div className="mc-hero-container">
          <div className="mc-title-group">
            <span className="mc-police-pill">
              <ShieldAlert size={14} /> Cyber Crime & Tourist Missing Cell
            </span>
            <h1 className="mc-hero-title">Automated E-FIR & Missing Complaints</h1>
            <p className="mc-hero-subtitle">
              Sensor-triggered safety monitoring alerts and official Electronic First Information Report (E-FIR) generation.
            </p>
          </div>

          <div className="mc-stats-strip">
            <div className="mc-stat-card cases-card" onClick={() => setFilterMode("missing")}>
              <span className="num">{stats.missing}</span>
              <span className="lbl">Missing E-FIR Cases</span>
            </div>
            <div className="mc-stat-card total-card" onClick={() => setFilterMode("all")}>
              <span className="num">{stats.total}</span>
              <span className="lbl">Total Safety Alerts</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="mc-main-body">
        {/* Controls Bar */}
        <div className="mc-controls-bar">
          <div className="mc-search-box">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search by DTID or Tourist Name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="mc-input-field"
            />
            {query && (
              <button onClick={() => setQuery("")} className="btn-clear-q">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="mc-filter-pills">
            <button
              className={`filter-pill ${filterMode === "all" ? "active" : ""}`}
              onClick={() => setFilterMode("all")}
            >
              All Alerts ({stats.total})
            </button>
            <button
              className={`filter-pill ${filterMode === "missing" ? "active" : ""}`}
              onClick={() => setFilterMode("missing")}
            >
              <span className="amber-dot"></span> Missing Cases ({stats.missing})
            </button>
            <button
              className={`filter-pill ${filterMode === "pending" ? "active" : ""}`}
              onClick={() => setFilterMode("pending")}
            >
              <span className="slate-dot"></span> Pending Review ({stats.pending})
            </button>
          </div>

          <div className="mc-actions-right">
            <button className="btn-refresh-accent" onClick={handleRefresh} disabled={loading}>
              <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
              <span>Refresh Alerts</span>
            </button>
          </div>
        </div>

        {/* Loading */}
        {loading && items.length === 0 && (
          <div className="mc-skeleton-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mc-skel-card">
                <div className="mc-skel-head" />
                <div className="mc-skel-line" />
                <div className="mc-skel-line short" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {filteredItems.length === 0 && !loading ? (
          <div className="mc-empty-card">
            <FileText size={56} className="empty-svg" />
            <h3>No E-FIR Complaints Found</h3>
            <p>No missing tourist safety records match your current search query.</p>
          </div>
        ) : (
          <div className="mc-cards-grid">
            {filteredItems.map((a, index) => (
              <MemoTouristCard
                key={a.id ?? `${a.dtid}-${index}`}
                tourist={touristByDtid[a.dtid] || globalTouristsMap[a.dtid]}
                index={index}
                alert={a}
                onReportMissing={reportMissingAndFileEfir}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
