path = 'ds_tester/backend/anomaly_mailer.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace Header
old_header = """          <!-- Header Banner (High-Contrast, Guaranteed Outlook Compatibility) -->
          <tr>
            <td bgcolor="#0f172a" style="background-color:#0f172a; padding:22px 28px; border-bottom:4px solid #dc2626;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Priority Pill -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;">
                      <tr>
                        <td bgcolor="#dc2626" style="background-color:#dc2626; padding:3px 10px; border-radius:4px;">
                          <font color="#ffffff" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="1">
                            <b style="color:#ffffff !important; font-size:11px; letter-spacing:0.5px;">{priority.upper()}</b>
                          </font>
                        </td>
                      </tr>
                    </table>

                    <!-- Header Title -->
                    <div style="font-size:22px; font-weight:800; line-height:1.2; margin:0; color:#ffffff !important;">
                      <font color="#ffffff" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="5">
                        <b style="color:#ffffff !important;">{client_label} &bull; Commercial Anomaly Report</b>
                      </font>
                    </div>

                    <!-- Subtitle -->
                    <div style="font-size:12px; margin-top:6px; color:#cbd5e1 !important;">
                      <font color="#cbd5e1" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="2">
                        Trailytics Data Science Sentinel &bull; ClickHouse OLAP Verified Parity
                      </font>
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <font color="#e2e8f0" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="2">
                      <b style="color:#e2e8f0 !important;">{now_str}</b>
                    </font>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""

new_header = """          <!-- Header Banner (Executive High-Contrast Card, 100% Immune to Outlook CSS Inversion) -->
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff; padding:24px 28px; border-bottom:4px solid #dc2626;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- Priority Pill -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:10px;">
                      <tr>
                        <td bgcolor="#dc2626" style="background-color:#dc2626; padding:4px 12px; border-radius:4px;">
                          <font color="#ffffff" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="1">
                            <b style="color:#ffffff !important; font-size:11px; letter-spacing:0.8px;">{priority.upper()}</b>
                          </font>
                        </td>
                      </tr>
                    </table>

                    <!-- Header Title -->
                    <div style="font-size:24px; font-weight:800; line-height:1.2; margin:0; color:#0f172a !important;">
                      <font color="#0f172a" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="5">
                        <b style="color:#0f172a !important;">{client_label} &bull; Commercial Anomaly Report</b>
                      </font>
                    </div>

                    <!-- Subtitle -->
                    <div style="font-size:12px; margin-top:6px; color:#64748b !important;">
                      <font color="#64748b" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="2">
                        Trailytics Data Science Sentinel &bull; ClickHouse OLAP Verified Parity
                      </font>
                    </div>
                  </td>
                  <td align="right" valign="top">
                    <div style="background-color:#f1f5f9; padding:6px 14px; border-radius:6px; border:1px solid #e2e8f0; display:inline-block;">
                      <font color="#334155" face="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" size="2">
                        <b style="color:#334155 !important;">{now_str}</b>
                      </font>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""

# Replace Bottom Buttons
old_buttons = """          <!-- Bottom Action Row (Bulletproof Table-Based Outlook Buttons) -->
          <tr>
            <td align="center" bgcolor="#f1f5f9" style="padding:22px 28px; background-color:#f1f5f9; border-top:1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table; margin-right:12px;">
                <tr>
                  <td align="center" bgcolor="#1d4ed8" style="background-color:#1d4ed8; border-radius:6px; padding:12px 24px;">
                    <a href="{target_host}/ds-tester?client={client}" target="_blank" style="color:#ffffff !important; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:13px; font-weight:800; text-decoration:none; display:inline-block;">
                      <font color="#ffffff"><b>Open DS Tester Workspace &rarr;</b></font>
                    </a>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;">
                <tr>
                  <td align="center" bgcolor="#ffffff" style="background-color:#ffffff; border:1px solid #94a3b8; border-radius:6px; padding:11px 22px;">
                    <a href="{target_host}/" target="_blank" style="color:#0f172a !important; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:13px; font-weight:800; text-decoration:none; display:inline-block;">
                      <font color="#0f172a"><b>Live Client Dashboard &rarr;</b></font>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""

new_buttons = """          <!-- Bottom Action Row (Bulletproof Table-Based Outlook Buttons - Dual Solid High-Contrast) -->
          <tr>
            <td align="center" bgcolor="#f8fafc" style="padding:22px 28px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
                <tr>
                  <td align="center" bgcolor="#1d4ed8" style="background-color:#1d4ed8; border-radius:6px; padding:12px 24px; text-align:center;">
                    <a href="{target_host}/ds-tester?client={client}" target="_blank" style="color:#ffffff !important; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:13px; font-weight:800; text-decoration:none; display:inline-block;">
                      <font color="#ffffff"><b style="color:#ffffff !important;">Open DS Tester Workspace &rarr;</b></font>
                    </a>
                  </td>
                  <td width="16" style="width:16px;">&nbsp;</td>
                  <td align="center" bgcolor="#0f172a" style="background-color:#0f172a; border-radius:6px; padding:12px 24px; text-align:center;">
                    <a href="{target_host}/dashboard" target="_blank" style="color:#ffffff !important; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size:13px; font-weight:800; text-decoration:none; display:inline-block;">
                      <font color="#ffffff"><b style="color:#ffffff !important;">Live Client Dashboard &rarr;</b></font>
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>"""

content_norm = content.replace('\r\n', '\n')
old_header_norm = old_header.replace('\r\n', '\n')
new_header_norm = new_header.replace('\r\n', '\n')
old_buttons_norm = old_buttons.replace('\r\n', '\n')
new_buttons_norm = new_buttons.replace('\r\n', '\n')

assert old_header_norm in content_norm, 'old_header not found!'
assert old_buttons_norm in content_norm, 'old_buttons not found!'

content_norm = content_norm.replace(old_header_norm, new_header_norm, 1)
content_norm = content_norm.replace(old_buttons_norm, new_buttons_norm, 1)

with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content_norm)

print('Successfully updated anomaly_mailer.py with executive high-contrast header and buttons!')
