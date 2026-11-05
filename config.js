// =====================================================================
// Fruit Consultation · settings
// This is the only file you need to edit.
// =====================================================================
window.APP_CONFIG = {
  // Firebase connection. Leave it as null until you connect (the page opens in demo mode).
  // To connect, delete null and paste the { ... } you copied from the Firebase console.
     firebase: {
     apiKey: "AIza.....",
     authDomain: "......firebaseapp.com",
     projectId: "......",
     storageBucket: "......",
     messagingSenderId: "......",
     appId: "......"
   },

  // Church name (shown at the top of the form and on the QR poster)
  churchName: "Swiss Church",

  // Time slots on the request form
  days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  periods: ["Morning", "Afternoon", "Evening"],

  // Relationship choices ("Other" lets people type their own)
  relations: ["Family", "Friend", "Work", "School", "Neighbour", "Introduced"],

  // Departments and groups used until the coordinator saves their own
  // in the "Groups & leaders" tab (that version takes priority).
  departments: [
    { name: "Youth", zones: ["Zurich Team 1", "Zurich Team 2", "Zurich Team 3", "Zurich Team 4"] },
    { name: "Women's", zones: ["Group 1", "Group 2"] },
    { name: "Men's", zones: ["Group 1", "Group 2"] },
    { name: "Geneva", zones: ["Geneva"] },
    { name: "Newcomers", zones: ["Newcomers"] },
  ],
};
