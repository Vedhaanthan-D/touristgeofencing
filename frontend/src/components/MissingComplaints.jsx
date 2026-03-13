import { useEffect, useState, useMemo, useCallback, memo } from "react";
import axios from "axios";
import "./MissingComplaints.css";
import { jsPDF } from "jspdf";

function formatDate(value) {
  if (!value) return "-";
  try {
    // Firestore Timestamp-like
    if (typeof value === "object" && value) {
      if (typeof value.toDate === "function") {
        const d = value.toDate();
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(d);
      }
      if (typeof value.seconds === "number") {
        const d = new Date(value.seconds * 1000);
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(d);
      }
      if (typeof value._seconds === "number") {
        const d = new Date(value._seconds * 1000);
        return new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "medium",
        }).format(d);
      }
    }

    // Numeric
    if (
      typeof value === "number" ||
      (typeof value === "string" && /^\d+$/.test(value.trim()))
    ) {
      const num = Number(value);
      const ms = num > 1e12 ? num : num * 1000;
      const d = new Date(ms);
      return new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(d);
    }

    // String possibly prefixed with 'createdAt'
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

function formatTripDetails(tripDetails) {
  if (!tripDetails) return "N/A";
  if (typeof tripDetails === "string") {
    try {
      tripDetails = JSON.parse(tripDetails);
    } catch {
      return tripDetails;
    }
  }
  return (
    <div className="mc-trip-details">
      {tripDetails.destination && (
        <div>
          <strong>Destination:</strong> {tripDetails.destination}
        </div>
      )}
      {tripDetails.startDate && (
        <div>
          <strong>Start Date:</strong>{" "}
          {new Date(tripDetails.startDate).toLocaleDateString("en-IN")}
        </div>
      )}
      {tripDetails.returnDate && (
        <div>
          <strong>Return Date:</strong>{" "}
          {new Date(tripDetails.returnDate).toLocaleDateString("en-IN")}
        </div>
      )}
      {tripDetails.endDate && (
        <div>
          <strong>End Date:</strong>{" "}
          {new Date(tripDetails.endDate).toLocaleDateString("en-IN")}
        </div>
      )}
      {tripDetails.dates && (
        <div>
          <strong>Dates:</strong> {tripDetails.dates}
        </div>
      )}
      {tripDetails.purpose && (
        <div>
          <strong>Purpose:</strong> {tripDetails.purpose}
        </div>
      )}
    </div>
  );
}

function formatEmergencyContacts(contacts) {
  if (!contacts) return "N/A";
  if (typeof contacts === "string") {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      return contacts;
    }
  }
  if (Array.isArray(contacts)) {
    return (
      <div className="mc-emergency-contacts">
        {contacts.map((contact, index) => (
          <div key={index} className="mc-contact-item">
            <div>
              <strong>{contact.name}</strong>
            </div>
            <div>{contact.phone}</div>
          </div>
        ))}
      </div>
    );
  }
  return contacts.name
    ? `${contacts.name}: ${contacts.phone}`
    : JSON.stringify(contacts);
}

// NEW: Separate function for PDF text formatting
const formatEmergencyContactsForPDF = (contacts) => {
  if (!contacts) return "N/A";

  // Handle string contacts
  if (typeof contacts === "string") {
    try {
      contacts = JSON.parse(contacts);
    } catch {
      return contacts;
    }
  }

  // Handle array contacts
  if (Array.isArray(contacts)) {
    return contacts
      .map(
        (contact) =>
          `${contact.name || "Unknown"}: ${contact.phone || "No phone"}`
      )
      .join("; ");
  }

  // Handle object contacts
  if (typeof contacts === "object" && contacts !== null) {
    return `${contacts.name || "Unknown"}: ${contacts.phone || "No phone"}`;
  }

  return "N/A";
};

// NEW: Format trip details for PDF
const formatTripDetailsForPDF = (tripDetails) => {
  if (!tripDetails) return "N/A";

  if (typeof tripDetails === "string") {
    try {
      tripDetails = JSON.parse(tripDetails);
    } catch {
      return tripDetails;
    }
  }

  const details = [];
  if (tripDetails.destination)
    details.push(`Destination: ${tripDetails.destination}`);
  if (tripDetails.startDate)
    details.push(
      `Start: ${new Date(tripDetails.startDate).toLocaleDateString("en-IN")}`
    );
  if (tripDetails.returnDate)
    details.push(
      `Return: ${new Date(tripDetails.returnDate).toLocaleDateString("en-IN")}`
    );
  if (tripDetails.endDate)
    details.push(
      `End: ${new Date(tripDetails.endDate).toLocaleDateString("en-IN")}`
    );
  if (tripDetails.purpose) details.push(`Purpose: ${tripDetails.purpose}`);

  return details.length > 0 ? details.join(", ") : "N/A";
};

// PDF Generation function - FIXED
const formatFamilyMembersForPDF = (familyMembers) => {
  if (
    !familyMembers ||
    !Array.isArray(familyMembers) ||
    familyMembers.length === 0
  ) {
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
};

// NEW: Generate comprehensive missing person summary
const generateMissingPersonSummary = (tourist, alert) => {
  const touristName = tourist?.fullName || "The tourist";
  const nationality = tourist?.nationality || "Indian";
  const age = tourist?.age ? `${tourist.age} years` : "unknown age";
  const gender = tourist?.gender
    ? tourist.gender.toLowerCase()
    : "unknown gender";

  const lastKnownLocation =
    alert?.location?.latitude && alert?.location?.longitude
      ? `approximately ${alert.location.latitude}, ${alert.location.longitude}`
      : "unknown location";

  const lastSeenTime = alert?.createdAt
    ? formatDate(alert.createdAt)
    : "recently";
  const idleDuration = alert?.idleDuration
    ? formatSecondsToHHMM(alert.idleDuration)
    : "unknown period";

  const familyCount = tourist?.familyMembers?.length || 0;
  const familyInfo =
    familyCount > 0
      ? `The tourist was accompanied by ${familyCount} family member${familyCount > 1 ? "s" : ""
      }.`
      : "The tourist was traveling alone.";

  const tripPurpose = tourist?.tripDetails?.purpose || "tourism purposes";
  const destination = tourist?.tripDetails?.destination || "the local area";

  return `
${touristName}, a ${nationality} national of ${age} and ${gender}, has been reported missing through the automated tourist safety monitoring system.

INCIDENT SUMMARY:
The individual was last detected by the safety monitoring system at ${lastSeenTime} in the vicinity of ${lastKnownLocation}. The system registered unusual inactivity for a duration of ${idleDuration}, triggering an automatic missing person alert.

BACKGROUND:
${touristName} was visiting ${destination} for ${tripPurpose}. ${familyInfo} The digital tourist identification system (DTID: ${tourist?.dtid || "N/A"
    }) was actively monitoring the tourist's safety throughout their visit.

LAST KNOWN ACTIVITY:
Prior to the alert, the tourist's device showed normal activity patterns. The abrupt cessation of movement and system interaction, combined with the extended idle period, indicates a potential safety concern requiring immediate investigation.

IMMEDIATE ACTIONS TAKEN:
1. Automated E-FIR generation initiated
2. Local authorities notified via system integration
3. Emergency contacts alerted (if registered)
4. Real-time location data preserved for investigation

RECOMMENDED NEXT STEPS:
• Verify last known location with ground patrols
• Contact registered emergency contacts for additional information
• Check local hospitals and transportation hubs
• Review CCTV footage from the last known area
• Coordinate with local tourist police units

This case has been flagged as HIGH PRIORITY due to the automated nature of the alert and potential risk to tourist safety. Immediate investigative action is recommended.
  `.trim();
};

// Enhanced PDF Generation function with family members and summary
const generateEFIRPDF = (tourist, alert) => {
  try {
    const doc = new jsPDF();

    // Page 1: E-FIR Official Document
    // E-FIR Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("ELECTRONIC FIRST INFORMATION REPORT (E-FIR)", 105, 20, {
      align: "center",
    });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `FIR No: MIS/${alert?.id?.slice(-8) || "N/A"
      }/${new Date().getFullYear()}`,
      20,
      35
    );
    doc.text(`Police Station: Cyber Crime/Tourist Missing Cell`, 20, 42);
    doc.text(`Date & Time: ${new Date().toLocaleString("en-IN")}`, 20, 49);

    // Section 1: Complainant/Tourist Details
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
      [
        "Passport/ID No:",
        tourist?.passportNumber || tourist?.idNumber || "N/A",
      ],
      ["Contact Number:", tourist?.phone || tourist?.contactNumber || "N/A"],
      ["Email:", tourist?.email || "N/A"],
      [
        "Emergency Contacts:",
        formatEmergencyContactsForPDF(tourist?.emergencyContacts),
      ],
      ["Tourist ID Issue Date:", formatUnixSecondsToLocale(tourist?.issuedAt)],
      [
        "Expected Return Date:",
        formatUnixSecondsToLocale(tourist?.returnDate || tourist?.validTill),
      ],
    ];

    touristDetails.forEach(([label, value]) => {
      doc.text(`${label}`, 20, yPosition);
      const lines = doc.splitTextToSize(value || "N/A", 100);
      doc.text(lines, 80, yPosition);
      yPosition += lines.length * 6 + 2;
    });

    // Family Members Section
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

    // Section 2: Missing Incident Details
    yPosition += 10;
    doc.setFont("helvetica", "bold");
    doc.text("SECTION 2: MISSING INCIDENT DETAILS", 20, yPosition);

    yPosition += 10;
    doc.setFont("helvetica", "normal");
    const incidentDetails = [
      ["Alert Generated:", formatDate(alert?.createdAt)],
      [
        "Last Known Location:",
        `${alert?.location?.latitude || "-"}, ${alert?.location?.longitude || "-"
        }`,
      ],
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

    // Add page borders for official look
    doc.setDrawColor(0, 0, 128);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    // Page 2: Comprehensive Summary
    doc.addPage();

    doc.setDrawColor(0, 0, 128);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);
    // Summary Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 128);
    doc.text("MISSING PERSON CASE SUMMARY", 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `Case Reference: MIS/${alert?.id?.slice(-8) || "N/A"
      }/${new Date().getFullYear()}`,
      20,
      35
    );
    doc.text(`Missing Person: ${tourist?.fullName || "N/A"}`, 20, 42);
    doc.text(`DTID: ${tourist?.dtid || "N/A"}`, 20, 49);

    // Generate and add the comprehensive summary
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

    // Section 3: Additional Information
    summaryYPosition += 15;
    doc.setFont("helvetica", "bold");
    doc.text("INVESTIGATIVE NOTES & OBSERVATIONS:", 20, summaryYPosition);

    summaryYPosition += 10;
    doc.setFont("helvetica", "normal");
    const investigativeNotes = [
      "• Automated alert triggered by safety monitoring system",
      "• Last known location coordinates preserved for investigation",
      "• Emergency contacts have been automatically notified",
      "• Local tourist police units alerted via system integration",
      "• Case classified as HIGH PRIORITY - Tourist safety concern",
      "• Recommended immediate ground verification of last known location",
      "• Check local hospitals, transport hubs, and accommodation",
      "• Review CCTV footage from last known area",
      "• Coordinate with family members for additional information",
      "• Update case status every 2 hours until resolved",
    ];

    investigativeNotes.forEach((note) => {
      if (summaryYPosition > 250) {
        doc.addPage();
        summaryYPosition = 20;
      }
      const noteLines = doc.splitTextToSize(note, 160);
      noteLines.forEach((line) => {
        doc.text(line, 25, summaryYPosition);
        summaryYPosition += 6;
      });
      summaryYPosition += 2;
    });

    // Footer for summary page
    if (summaryYPosition > 220) {
      doc.addPage();
      summaryYPosition = 20;
    }

    doc.setFontSize(8);
    doc.text(
      "Note: This summary is auto-generated based on digital tourist safety monitoring system data.",
      20,
      summaryYPosition + 10
    );
    doc.text(
      "All timestamps and locations are system-recorded and require field verification.",
      20,
      summaryYPosition + 16
    );

    // Add border to summary page
    doc.setDrawColor(0, 0, 128);
    doc.setLineWidth(0.5);
    doc.rect(10, 10, 190, 277);

    // Save the PDF
    const fileName = `E-FIR_Missing_${tourist?.dtid || "Tourist"}_${new Date().toISOString().split("T")[0]
      }.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating E-FIR PDF. Please try again.");
  }
};

function TouristCard({ tourist, index, alert }) {
  const isActive = useMemo(() => {
    if (!tourist) return false;
    if (Object.prototype.hasOwnProperty.call(tourist, "isActive"))
      return tourist.isActive;
    const returnDate = tourist.returnDate || tourist.validTill;
    if (!returnDate) return false;
    const currentTime = Math.floor(Date.now() / 1000);
    return returnDate > currentTime;
  }, [tourist]);

  const handleDownloadEFIR = () => {
    if (!tourist) {
      alert("Tourist data not available yet. Please wait...");
      return;
    }
    generateEFIRPDF(tourist, alert);
  };

  if (!tourist) return null;

  const initials = (tourist.fullName || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mc-card-new">
      {/* Gradient Header */}
      <div className="mc-card-new-header">
        <div className="mc-card-new-header-left">
          <div className="mc-avatar">{initials}</div>
          <div className="mc-avatar-info">
            <div className="mc-avatar-name">{tourist.fullName || "Unknown"}</div>
            <div className="mc-avatar-dtid">{tourist.dtid}</div>
          </div>
        </div>
        <div className="mc-card-new-header-right">
          <span className={`mc-status-pill ${isActive ? "active" : "missing"}`}>
            {isActive ? "✓ Active" : "⚠ Missing"}
          </span>
          <span className="mc-card-index">#{typeof index === "number" ? index + 1 : ""}</span>
        </div>
      </div>

      {/* Alert Block */}
      {alert && (
        <div className="mc-alert-strip">
          <div className="mc-alert-strip-title">🚨 Alert Triggered</div>
          <div className="mc-alert-strip-grid">
            <div className="mc-alert-chip">
              <span className="mc-chip-label">Time</span>
              <span className="mc-chip-value">{formatDate(alert.createdAt)}</span>
            </div>
            {Number.isFinite(Number(alert.idleDuration)) && (
              <div className="mc-alert-chip">
                <span className="mc-chip-label">Idle</span>
                <span className="mc-chip-value">{formatSecondsToHHMM(alert.idleDuration)}</span>
              </div>
            )}
            <div className="mc-alert-chip">
              <span className="mc-chip-label">📍 Location</span>
              <span className="mc-chip-value">
                {alert?.location?.latitude ?? "—"}, {alert?.location?.longitude ?? "—"}
              </span>
            </div>
            {(() => {
              const uid = alert.userId || alert.uid || "";
              const hideUid = uid === "ZsWMn71fYrY2Z8qSCb4qxN7O4XC2";
              return !hideUid && uid ? (
                <div className="mc-alert-chip">
                  <span className="mc-chip-label">UID</span>
                  <span className="mc-chip-value mc-chip-mono">{uid}</span>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Info Body */}
      <div className="mc-card-new-body">
        {/* Tourist Details Row */}
        <div className="mc-info-grid">
          <div className="mc-info-cell">
            <span className="mc-cell-label">📞 Contact</span>
            <span className="mc-cell-value">{tourist.phone || tourist.contactNumber || "N/A"}</span>
          </div>
          {tourist.nationality && (
            <div className="mc-info-cell">
              <span className="mc-cell-label">🌐 Nationality</span>
              <span className="mc-cell-value">{tourist.nationality}</span>
            </div>
          )}
          <div className="mc-info-cell">
            <span className="mc-cell-label">📅 Issued</span>
            <span className="mc-cell-value">{formatUnixSecondsToLocale(tourist.issuedAt)}</span>
          </div>
          <div className="mc-info-cell">
            <span className="mc-cell-label">⏰ Return</span>
            <span className="mc-cell-value">{formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}</span>
          </div>
        </div>

        {/* Trip Details */}
        {tourist.tripDetails && (
          <div className="mc-section-block">
            <div className="mc-section-label">✈️ Trip Details</div>
            <div className="mc-section-content">{formatTripDetails(tourist.tripDetails)}</div>
          </div>
        )}

        {/* Family Members */}
        {tourist.familyMembers && tourist.familyMembers.length > 0 && (
          <div className="mc-section-block">
            <div className="mc-section-label">👨‍👩‍👧 Family Members ({tourist.familyMembers.length})</div>
            <div className="mc-family-tags">
              {tourist.familyMembers.map((member, i) => (
                <span key={i} className="mc-family-tag">
                  {member.fullName} · {member.age}y · {member.gender}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Emergency Contacts */}
        {tourist.emergencyContacts && (
          <div className="mc-section-block">
            <div className="mc-section-label">🆘 Emergency Contacts</div>
            <div className="mc-section-content">{formatEmergencyContacts(tourist.emergencyContacts)}</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mc-card-new-footer">
        <div className="mc-validity-text">
          {isActive
            ? `Valid until ${formatUnixSecondsToLocale(tourist.returnDate || tourist.validTill)}`
            : "Tourist reported missing"}
        </div>
        <button
          className="mc-efir-btn"
          onClick={handleDownloadEFIR}
          disabled={!tourist}
          title="Download E-FIR PDF"
        >
          📄 Download E-FIR
        </button>
      </div>
    </div>
  );
}

const MemoTouristCard = memo(TouristCard);

export default function MissingComplaints() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [touristByDtid, setTouristByDtid] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchItems() {
      setLoading(true);
      setError(null);
      try {
        const { data } = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/safety-alerts`
        );
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          const sorted = list.slice().sort((a, b) => {
            const da = new Date(a.createdAt).getTime() || 0;
            const db = new Date(b.createdAt).getTime() || 0;
            return db - da;
          });
          setItems(sorted);
          setLastUpdated(Date.now());
        }
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load safety alerts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItems();
    const id = setInterval(fetchItems, 300000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Fetch tourist details for any DTIDs we don't yet have
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/safety-alerts`
      );
      const list = Array.isArray(data) ? data : [];
      const sorted = list.slice().sort((a, b) => {
        const da = new Date(a.createdAt).getTime() || 0;
        const db = new Date(b.createdAt).getTime() || 0;
        return db - da;
      });
      setItems(sorted);
      setLastUpdated(Date.now());
    } catch (e) {
      setError(e.message || "Failed to load safety alerts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const dtids = items.map((a) => a.dtid).filter(Boolean);
    const missing = dtids.filter((d) => !touristByDtid[d]);
    if (missing.length === 0) return;
    let cancelled = false;

    const concurrency = 4;
    let i = 0;

    async function worker() {
      while (i < missing.length && !cancelled) {
        const dtid = missing[i++];
        try {
          const { data } = await axios.get(
            `${import.meta.env.VITE_API_URL}/api/tourists/${dtid}`
          );
          if (!cancelled) {
            setTouristByDtid((prev) =>
              prev[dtid] ? prev : { ...prev, [dtid]: data }
            );
          }
        } catch { }
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, missing.length) },
      () => worker()
    );
    Promise.all(workers);
    return () => {
      cancelled = true;
    };
  }, [items, touristByDtid]);

  return (
    <div className="mc-dashboard-container">
      <div className="mc-dashboard-header">
        <div className="mc-header-content">
          <h2 className="mc-section-title">
            <span className="mc-section-icon">🆘</span>
            Auto E-FIR Generation
          </h2>
          <p className="mc-section-subtitle">
            Missing tourists - Automated E-FIR PDF generation
          </p>
        </div>
        <div className="mc-header-actions">
          <button className="mc-btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
          {lastUpdated && (
            <div className="mc-last-updated">
              Updated{" "}
              {new Intl.DateTimeFormat("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(lastUpdated)}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="skeleton-grid">
          {Array.from({
            length: Math.max(3, Math.min(8, items.length || 6)),
          }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton header" />
              <div className="skeleton line" />
              <div className="skeleton line" />
              <div className="skeleton line short" />
              <div className="skeleton footer" />
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="mc-error-message">
          <div className="mc-error-icon">⚠️</div>
          <p>{error}</p>
        </div>
      )}

      {items.length === 0 && !loading ? (
        <div className="mc-empty-state">
          <div className="mc-empty-icon">📄</div>
          <h3>No E-FIR Cases</h3>
          <p>No missing tourist cases requiring E-FIR generation.</p>
        </div>
      ) : (
        <div className="mc-tourists-grid">
          {items.map((a, index) => (
            <div
              key={a.id ?? `${a.dtid}-${index}`}
              className="mc-tourist-card-wrapper"
            >
              <MemoTouristCard
                tourist={touristByDtid[a.dtid]}
                index={index}
                alert={a}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
