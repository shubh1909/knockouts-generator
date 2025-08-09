const API_BASE =
  "https://knockouts-generator.onrender.com" || "https://localhost:3001";

document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("createTournamentBtn")
    .addEventListener("click", createTournamentWithPDF);
  document.getElementById("quickPDFBtn").addEventListener("click", quickPDF);
  document
    .getElementById("pdfToJsonForm")
    .addEventListener("submit", handlePdfToJson);
  document
    .getElementById("copyJsonBtn")
    .addEventListener("click", copyJsonToClipboard);
  checkHealth();
  setTimeout(() => {
    document.getElementById("response").textContent =
      "🚀 Welcome to Knockout Tournament API v2.0!\n\nThis simplified version focuses on the essential functionality:\n• Create tournament fixtures from participant lists\n• Generate and download PDF brackets\n• ES6 modules architecture\n• Streamlined endpoints\n\nTry creating a tournament above! ⬆️";
  }, 1000);
});
// Copy JSON to clipboard handler
function copyJsonToClipboard() {
  const jsonText = document.getElementById("pdf-json-response").textContent;
  if (!jsonText) return;
  navigator.clipboard
    .writeText(jsonText)
    .then(() => {
      document.getElementById("copyJsonBtn").textContent = "✅";
      setTimeout(() => {
        document.getElementById("copyJsonBtn").textContent = "📋";
      }, 1200);
    })
    .catch(() => {
      document.getElementById("copyJsonBtn").textContent = "❌";
      setTimeout(() => {
        document.getElementById("copyJsonBtn").textContent = "📋";
      }, 1200);
    });
}
// PDF to JSON API call handler
async function handlePdfToJson(e) {
  e.preventDefault();
  const fileInput = document.getElementById("pdfFile");
  const file = fileInput.files[0];
  if (!file) {
    document.getElementById("pdf-json-response").textContent =
      "Please select a PDF file.";
    return;
  }
  const formData = new FormData();
  formData.append("pdf", file);
  try {
    const response = await fetch(`${API_BASE}/api/tournaments/pdf-to-json`, {
      method: "POST",
      body: formData,
    });
    if (response.ok) {
      const data = await response.json();
      document.getElementById("pdf-json-response").textContent = JSON.stringify(
        data,
        null,
        2
      );
    } else {
      const errorData = await response.json();
      document.getElementById(
        "pdf-json-response"
      ).textContent = `Error: ${errorData.message}`;
    }
  } catch (error) {
    document.getElementById(
      "pdf-json-response"
    ).textContent = `Error: ${error.message}`;
  }
}

async function apiCall(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      return { response, data };
    } else {
      return { response, data: null };
    }
  } catch (error) {
    return { error: error.message };
  }
}

async function checkHealth() {
  const { data, error } = await apiCall("/health");
  document.getElementById("status-response").textContent = error
    ? `Error: ${error}`
    : JSON.stringify(data, null, 2);
}

async function getAPIInfo() {
  const { data, error } = await apiCall("/api");
  document.getElementById("status-response").textContent = error
    ? `Error: ${error}`
    : JSON.stringify(data, null, 2);
}

async function createTournamentWithPDF() {
  const name = document.getElementById("tournamentName").value;
  const pdfTitle = document.getElementById("pdfTitle").value;
  const participantsText = document.getElementById("participants").value;
  const participants = participantsText.split("\n").filter((p) => p.trim());
  const returnType = document.getElementById("returnType").value;
  try {
    const requestBody = { name, participants, returnType };
    if (pdfTitle.trim()) {
      requestBody.pdfTitle = pdfTitle.trim();
    }
    const response = await fetch(
      `${API_BASE}/api/tournaments/create-with-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    if (returnType === "download" && response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tournament-${name || "bracket"}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      document.getElementById("response").textContent =
        "✅ Tournament created and PDF downloaded successfully!";
    } else {
      const data = await response.json();
      document.getElementById("response").textContent = response.ok
        ? JSON.stringify(data, null, 2)
        : `Error: ${data.message}`;
    }
  } catch (error) {
    document.getElementById("response").textContent = `Error: ${error.message}`;
    console.log(error);
  }
}

async function quickPDF() {
  const name = document.getElementById("tournamentName").value;
  const pdfTitle = document.getElementById("pdfTitle").value;
  const participantsText = document.getElementById("participants").value;
  const participants = participantsText.split("\n").filter((p) => p.trim());
  try {
    const requestBody = { name, participants };
    if (pdfTitle.trim()) {
      requestBody.pdfTitle = pdfTitle.trim();
    }
    const response = await fetch(`${API_BASE}/api/tournaments/quick-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quick-tournament-${name || "bracket"}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      document.getElementById("response").textContent =
        "⚡ Quick PDF downloaded successfully!";
    } else {
      const errorData = await response.json();
      document.getElementById(
        "response"
      ).textContent = `Error: ${errorData.message}`;
    }
  } catch (error) {
    document.getElementById("response").textContent = `Error: ${error.message}`;
  }
}
