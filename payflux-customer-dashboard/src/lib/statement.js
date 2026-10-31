const escapeCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Build a CSV statement from the rows the dashboard is showing. */
export function statementCsv(items) {
  const rows = [
    ["Date", "Name", "Details", "Amount (INR)", "Status", "Mode"],
    ...items.map((x) => [x.d, x.n, x.b, Number(x.a).toFixed(2), x.s, x.demo ? "Demo" : "Live"]),
  ];
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function downloadFile(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadStatementCsv(items, when = new Date()) {
  const stamp = when.toISOString().slice(0, 10);
  downloadFile(`tappay-statement-${stamp}.csv`, statementCsv(items));
  return `tappay-statement-${stamp}.csv`;
}
