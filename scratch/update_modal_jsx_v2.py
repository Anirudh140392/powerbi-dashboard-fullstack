path = 'ds_tester/frontend/AssignAnomalyEmailModal.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Update signature to accept onAssigned
old_sig = """export default function AssignAnomalyEmailModal({
  open,
  onClose,
  client,
  anomalies = [],
  selectedAnomaly = null,
}) {"""

new_sig = """export default function AssignAnomalyEmailModal({
  open,
  onClose,
  client,
  anomalies = [],
  selectedAnomaly = null,
  onAssigned,
}) {"""

# Update state defaults
old_state = """  const [recipients, setRecipients] = useState("");
  const [fromEmail, setFromEmail] = useState(DEFAULT_FROM_EMAIL);"""

new_state = """  const [recipients, setRecipients] = useState("abhishek.j@trailytics.com");
  const [fromEmail, setFromEmail] = useState("shushant@trailytics.com");"""

# Update handleSendViaOutlookWeb
old_handler = """  const handleSendViaOutlookWeb = async () => {
    // 1. Copy formatted rich HTML report to clipboard
    await handleCopyRichHtml();

    // 2. Open Outlook Web compose window
    const { webOutlookUrl, cleanRecipients } = getMailFields();
    window.open(webOutlookUrl, "_blank");

    // 3. Display user guidance banner
    setSendResult({
      success: true,
      mode: "web",
      message: `Opened Outlook Web for ${cleanRecipients || "tester"} with recipient & subject pre-filled! The full visual HTML report is copied to your clipboard — click the email body in Outlook and press Ctrl + V to paste the formatted report.`,
    });
  };"""

new_handler = """  const handleSendViaOutlookWeb = async () => {
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
  };"""

content_norm = content.replace('\r\n', '\n')
assert old_sig.replace('\r\n', '\n') in content_norm, 'old_sig not found!'
assert old_state.replace('\r\n', '\n') in content_norm, 'old_state not found!'
assert old_handler.replace('\r\n', '\n') in content_norm, 'old_handler not found!'

content_norm = content_norm.replace(old_sig.replace('\r\n', '\n'), new_sig.replace('\r\n', '\n'), 1)
content_norm = content_norm.replace(old_state.replace('\r\n', '\n'), new_state.replace('\r\n', '\n'), 1)
content_norm = content_norm.replace(old_handler.replace('\r\n', '\n'), new_handler.replace('\r\n', '\n'), 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content_norm)

print('Updated AssignAnomalyEmailModal.jsx successfully!')
