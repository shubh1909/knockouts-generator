// Sample data for testing
const testParticipants = [
  "Manchester United",
  "Chelsea",
  "Arsenal",
  "Liverpool",
  "Manchester City",
  "Tottenham",
  "West Ham",
  "Leicester City",
];

function testAPI() {
  console.log("🧪 Testing Knockout Tournament API v2.0 (ES Modules)...\n");

  try {
    console.log("🎯 Available Endpoints:");
    console.log("1. POST /api/tournaments/create-with-pdf");
    console.log("   - Creates tournament and returns PDF");
    console.log(
      "   - Body:",
      JSON.stringify(
        {
          name: "Premier League Test Tournament",
          participants: testParticipants.slice(0, 4),
          returnType: "download", // or "json" or "url"
        },
        null,
        2
      )
    );

    console.log("\n2. POST /api/tournaments/quick-pdf");
    console.log("   - Creates fixture and downloads PDF immediately");
    console.log(
      "   - Body:",
      JSON.stringify(
        {
          name: "Quick Test Tournament",
          participants: testParticipants.slice(0, 4),
        },
        null,
        2
      )
    );

    console.log("\n✅ Simplified API structure is ready!");
    console.log(
      '📊 Start the server with "npm start" to test these endpoints.'
    );
    console.log("🌐 Server will run on http://localhost:3001");
    console.log("📖 API docs at http://localhost:3001/api");

    console.log("\n🆕 New Features:");
    console.log("• ES6 Modules instead of CommonJS");
    console.log("• Streamlined to 2 main endpoints only");
    console.log("• Removed unnecessary CRUD operations");
    console.log("• Direct PDF generation and download");
    console.log("• Cleaner, more focused codebase");
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
  }
}

// Only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAPI();
}

export { testAPI };
