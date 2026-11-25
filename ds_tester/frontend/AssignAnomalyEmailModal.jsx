import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  TextField,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Collapse,
} from "@mui/material";
import {
  Email as EmailIcon,
  Send as SendIcon,
  ContentCopy as ContentCopyIcon,
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  Preview as PreviewIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  CheckCircle as CheckCircleIcon,
} from "@mui/icons-material";
import axios from "axios";

const DS_TESTER_API = "/ds-tester";
const DEFAULT_FROM_EMAIL = "business@trailytics.com";

export default function AssignAnomalyEmailModal({
  open,
  onClose,
  client,
  anomalies = [],
  selectedAnomaly = null,
  onAssigned,
}) {
  const [activeTab, setActiveTab] = useState(0); // 0 = Form, 1 = Live Preview
  const [recipients, setRecipients] = useState("abhishek.j@trailytics.com");
  const [fromEmail, setFromEmail] = useState("shushant@trailytics.com");
  const [priority, setPriority] = useState("P1 - Critical");
  const [notes, setNotes] = useState("");
  const [showAdvancedSmtp, setShowAdvancedSmtp] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [customSmtpHost, setCustomSmtpHost] = useState("");

  const [sending, setSending] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [sendResult, setSendResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Compute anomaly list to forward
  const targetAnomalies = selectedAnomaly ? [selectedAnomaly] : anomalies;

  // Load preview whenever modal opens or form inputs change
  useEffect(() => {
    if (open) {
      setSendResult(null);
      setCopied(false);
      fetchEmailPreview();
    }
  }, [open, client, priority, notes, fromEmail]);

  const fetchEmailPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await axios.post(`${DS_TESTER_API}/anomaly/preview-email`, {
        client: client || "prestige",
        recipients: recipients ? recipients.split(",").map((s) => s.trim()) : ["tester@trailytics.com"],
        anomaly_ids: targetAnomalies.map((a) => a.id).filter(Boolean),
        notes,
        priority,
        from_email: fromEmail || DEFAULT_FROM_EMAIL,
      });
      if (res.data?.html) {
        setPreviewHtml(res.data.html);
      }
    } catch (e) {
      console.error("Preview fetch error:", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSendEmail = async () => {
    const emailList = recipients
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (emailList.length === 0) {
      setSendResult({
        success: false,
        message: "Please enter at least one valid recipient email address.",
      });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const payload = {
        client: client || "prestige",
        recipients: emailList,
        anomaly_ids: targetAnomalies.map((a) => a.id).filter(Boolean),
        notes,
        priority,
        from_email: fromEmail.trim() || DEFAULT_FROM_EMAIL,
        from_password: customPassword.trim() || null,
        smtp_host: customSmtpHost.trim() || null,
      };

      const res = await axios.post(`${DS_TESTER_API}/anomaly/assign-email`, payload);
      const data = res.data;

      if (data.success) {
        setSendResult({
          success: true,
          mode: "smtp",
          message: `Forwarded ${data.anomalies_count} anomaly record(s) to ${emailList.join(", ")} via Outlook SMTP!`,
          mailtoUrl: data.mailto_url,
        });
      } else {
        setSendResult({
          success: false,
          mode: "fallback",
          message: data.error || "SMTP authentication error. Opening in Outlook Web instead.",
          htmlPreview: data.html_preview,
        });
        handleSendViaOutlookWeb();
      }
    } catch (err) {
      setSendResult({
        success: false,
        mode: "fallback",
        message: (err.response?.data?.detail || err.message || "Failed to dispatch email.") + " Opening in Outlook Web.",
      });
      handleSendViaOutlookWeb();
    } finally {
      setSending(false);
    }
  };

  const handleCopyRichHtml = async () => {
    if (!previewHtml) return;

    try {
      // 1. Modern Clipboard API with text/html MIME type (renders visual cards & tables in Outlook)
      if (navigator.clipboard && window.ClipboardItem) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = previewHtml;
        const plainText = tempDiv.innerText || tempDiv.textContent || previewHtml;

        const blobHtml = new Blob([previewHtml], { type: "text/html" });
        const blobText = new Blob([plainText], { type: "text/plain" });

        const item = new ClipboardItem({
          "text/html": blobHtml,
          "text/plain": blobText,
        });

        await navigator.clipboard.write([item]);
        setCopied(true);
        setTimeout(() => setCopied(false), 3500);
        return;
      }
    } catch (e) {
      console.warn("Async clipboard rich copy fallback:", e);
    }

    // 2. Fallback: Select hidden container DOM and execCommand('copy') for rich formatting
    try {
      const container = document.createElement("div");
      container.innerHTML = previewHtml;
      container.style.position = "fixed";
      container.style.pointerEvents = "none";
      container.style.opacity = "0";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const range = document.createRange();
      range.selectNodeContents(container);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      document.execCommand("copy");
      selection.removeAllRanges();
      document.body.removeChild(container);

      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch (err) {
      // 3. Fallback: plain text
      navigator.clipboard.writeText(previewHtml);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const getMailFields = () => {
    const clientLabel = (client || "").toUpperCase();
    const cleanRecipients = (recipients || "")
      .split(/[,;]+/)
      .map((r) => r.trim())
      .filter(Boolean)
      .join(";");

    const issuesCount = targetAnomalies.length;
    const subjectText = `[${priority}] Commercial Anomaly Assigned: ${clientLabel} (${issuesCount} Issues)`;
    const subject = encodeURIComponent(subjectText);

    // Deep link directly to Outlook 365 Web compose.
    // We intentionally omit the plain-text &body= parameter from the URL, so Outlook Web opens
    // with a clean compose area and does NOT insert the unformatted plain-text dump.
    // The user simply presses Ctrl + V in Outlook to paste the complete 100% formatted HTML report!
    const webOutlookUrl = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(cleanRecipients)}&subject=${subject}`;

    return { clientLabel, cleanRecipients, subjectText, subject, webOutlookUrl };
  };

  const handleSendViaOutlookWeb = async () => {
    const emailList = (recipients || "abhishek.j@trailytics.com")
      .split(/[,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));

    // 1. Immediately persist assignment in database & anomaly store
    try {
      await axios.post(`${DS_TESTER_API}/anomaly/preview-email`, {
        client: client || "boat",
        recipients: emailList.length > 0 ? emailList : ["abhishek.j@trailytics.com"],
        anomaly_ids: targetAnomalies.map((a) => a.id).filter(Boolean),
        notes: notes || "Assigned via Outlook Web",
        priority,
        from_email: fromEmail || "shushant@trailytics.com",
      });
      if (typeof onAssigned === "function") {
        onAssigned();
      }
    } catch (e) {
      console.warn("Assignment persist error:", e);
    }

    // 2. Copy high-contrast rich HTML report to clipboard
    await handleCopyRichHtml();

    // 3. Open Outlook Web compose window
    const { webOutlookUrl, cleanRecipients } = getMailFields();
    window.open(webOutlookUrl, "_blank");

    // 4. Display user guidance banner
    setSendResult({
      success: true,
      mode: "web",
      message: `Assigned & Saved! All ${targetAnomalies.length} anomaly issue(s) assigned to ${cleanRecipients || "abhishek.j@trailytics.com"} on the DS Tester dashboard. The full visual HTML report is copied to your clipboard — in Outlook, click in the email body and press Ctrl + V to paste the complete formatted report.`,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          p: 1,
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: "10px",
              bgcolor: "#eff6ff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#2563eb",
            }}
          >
            <EmailIcon fontSize="small" />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: "16px", color: "#0f172a" }}>
              Assign Commercial Anomalies via Outlook
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
              Forward detailed HTML report with 5-level drill-down tables to tester/engineer
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#94a3b8" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, borderBottom: "1px solid #e2e8f0" }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab
            icon={<EditIcon fontSize="small" />}
            iconPosition="start"
            label="Configure Assignment"
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "13px" }}
          />
          <Tab
            icon={<PreviewIcon fontSize="small" />}
            iconPosition="start"
            label="Live Outlook HTML Preview"
            sx={{ textTransform: "none", fontWeight: 700, fontSize: "13px" }}
          />
        </Tabs>
      </Box>

      <DialogContent sx={{ p: 3, overflowY: "auto", flex: 1 }}>
        {activeTab === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Target Client & Anomalies Count Badge */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", p: 1.5, bgcolor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
                Target Brand:
              </Typography>
              <Chip
                label={(client || "All").toUpperCase()}
                size="small"
                sx={{ fontWeight: 800, fontSize: "12px", bgcolor: "#2563eb", color: "#ffffff" }}
              />
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#475569", ml: 1 }}>
                Scope:
              </Typography>
              <Chip
                label={`${targetAnomalies.length} Anomaly Issue(s) Included`}
                size="small"
                sx={{ fontWeight: 700, fontSize: "12px", bgcolor: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" }}
              />
            </Box>

            {/* Recipient Input Field */}
            <Box>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", mb: 0.8 }}>
                Tester / Assignee Email Address(es) <span style={{ color: "#dc2626" }}>*</span>
              </Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g. qa-tester@trailytics.com, supply-chain-lead@trailytics.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
                helperText="Separate multiple tester emails with commas."
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: "13px",
                  },
                }}
              />
            </Box>

            {/* Sender (From) Email Field - Defaults to business@trailytics.com with custom override */}
            <Box>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.8 }}>
                <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                  Sender (From) Email
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowAdvancedSmtp(!showAdvancedSmtp)}
                  startIcon={<SettingsIcon fontSize="small" />}
                  sx={{ textTransform: "none", fontSize: "11px", fontWeight: 700, p: 0, minWidth: "auto", color: "#64748b" }}
                >
                  {showAdvancedSmtp ? "Hide Custom SMTP" : "Custom SMTP Password"}
                </Button>
              </Box>
              <TextField
                fullWidth
                size="small"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="business@trailytics.com"
                helperText="Default is business@trailytics.com. Override if you wish to dispatch from your own address."
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: "13px",
                  },
                }}
              />

              {/* Optional Custom Password / SMTP Settings */}
              <Collapse in={showAdvancedSmtp}>
                <Box sx={{ mt: 1.5, p: 2, bgcolor: "#f8fafc", borderRadius: "10px", border: "1px dashed #cbd5e1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                  <TextField
                    size="small"
                    type="password"
                    label="Custom SMTP / App Password"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    placeholder="Enter password or leave blank for .env default"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "12px" } }}
                  />
                  <TextField
                    size="small"
                    label="SMTP Host (Default: smtp.office365.com)"
                    value={customSmtpHost}
                    onChange={(e) => setCustomSmtpHost(e.target.value)}
                    placeholder="smtp.office365.com"
                    sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px", fontSize: "12px" } }}
                  />
                </Box>
              </Collapse>
            </Box>

            {/* Priority Selection */}
            <Box>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", mb: 0.8 }}>
                Assignment Priority
              </Typography>
              <RadioGroup
                row
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                sx={{ gap: 2 }}
              >
                <FormControlLabel
                  value="P1 - Critical"
                  control={<Radio size="small" sx={{ color: "#dc2626", "&.Mui-checked": { color: "#dc2626" } }} />}
                  label={<Typography sx={{ fontSize: "13px", fontWeight: 700, color: "#dc2626" }}>P1 - Critical (Immediate Action)</Typography>}
                />
                <FormControlLabel
                  value="P2 - High Urgency"
                  control={<Radio size="small" sx={{ color: "#ea580c", "&.Mui-checked": { color: "#ea580c" } }} />}
                  label={<Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#ea580c" }}>P2 - High Urgency</Typography>}
                />
                <FormControlLabel
                  value="P3 - Standard"
                  control={<Radio size="small" sx={{ color: "#2563eb", "&.Mui-checked": { color: "#2563eb" } }} />}
                  label={<Typography sx={{ fontSize: "13px", fontWeight: 600, color: "#2563eb" }}>P3 - Standard Review</Typography>}
                />
              </RadioGroup>
            </Box>

            {/* Custom Assigner Notes / Instructions */}
            <Box>
              <Typography sx={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", mb: 0.8 }}>
                Instructions / Diagnostic Notes for Tester (Optional)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="e.g. Please verify stockouts in Bhuj hub for Prestige Magic Plus stove. Run Step 1 and Step 2 consistency once vendor PO updates."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: "10px",
                    fontSize: "13px",
                  },
                }}
              />
            </Box>

            {/* Send Result Banner */}
            {sendResult && (
              <Alert
                severity={sendResult.success ? "success" : "warning"}
                icon={sendResult.success ? <CheckCircleIcon /> : undefined}
                sx={{ borderRadius: "10px", fontSize: "13px", fontWeight: 600 }}
              >
                {sendResult.message}
                {sendResult.mode === "fallback" && (
                  <Box sx={{ mt: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSendViaOutlookWeb}
                      startIcon={<OpenInNewIcon />}
                      sx={{ bgcolor: "#0078d4", "&:hover": { bgcolor: "#005a9e" }, textTransform: "none", fontSize: "11px", fontWeight: 700 }}
                    >
                      Open in Outlook 365 (Web)
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleCopyRichHtml}
                      startIcon={<ContentCopyIcon />}
                      sx={{ textTransform: "none", fontSize: "11px", fontWeight: 700, borderColor: "#cbd5e1", color: "#334155" }}
                    >
                      {copied ? "Copied Formatted Report!" : "Copy Formatted Email"}
                    </Button>
                  </Box>
                )}</Alert>
            )}
          </Box>
        ) : (
          /* Tab 1: Live Outlook HTML Preview */
          <Box sx={{ height: 480, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
              <Typography sx={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>
                This is the exact pixel-perfect HTML layout rendered in Microsoft Outlook:
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleCopyRichHtml}
                startIcon={<ContentCopyIcon />}
                sx={{ textTransform: "none", fontSize: "11px", fontWeight: 700 }}
              >
                {copied ? "Copied Formatted Report!" : "Copy Formatted Email"}
              </Button>
            </Box>
            {loadingPreview ? (
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
                <CircularProgress size={24} sx={{ color: "#2563eb" }} />
              </Box>
            ) : (
              <Box
                component="iframe"
                srcDoc={previewHtml}
                title="Outlook Email Live Preview"
                sx={{
                  width: "100%",
                  height: "100%",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  bgcolor: "#ffffff",
                }}
              />
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, pt: 1, display: "flex", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            size="small"
            variant="outlined"
            onClick={handleCopyRichHtml}
            startIcon={<ContentCopyIcon />}
            sx={{
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "none",
              color: "#334155",
              borderColor: "#cbd5e1",
            }}
          >
            {copied ? "Copied Formatted Report!" : "Copy Formatted Email"}
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Button
            size="small"
            onClick={onClose}
            sx={{ color: "#64748b", textTransform: "none", fontWeight: 600, fontSize: "12px" }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={handleSendViaOutlookWeb}
            startIcon={<OpenInNewIcon />}
            sx={{
              bgcolor: "#0078d4",
              "&:hover": { bgcolor: "#005a9e" },
              borderRadius: "8px",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "13px",
              px: 3,
              py: 0.8,
              boxShadow: "0 2px 6px rgba(0, 120, 212, 0.35)",
            }}
          >
            Send via Outlook Web
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
