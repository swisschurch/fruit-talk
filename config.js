// =====================================================================
// Fruit Consultation · settings
// This is the only file you need to edit.
// =====================================================================
window.APP_CONFIG = {
  // Firebase connection. Leave it as null until you connect (the page opens in demo mode).
  // To connect, delete null and paste the { ... } you copied from the Firebase console.
  firebase: {
    apiKey: "AIzaSyDUETVEZfDzOIRgkgN6frDdyLRjgSeGCrU",
    authDomain: "fruit-consultation.firebaseapp.com",
    projectId: "fruit-consultation",
    storageBucket: "fruit-consultation.firebasestorage.app",
    messagingSenderId: "753415680124",
    appId: "1:753415680124:web:21d4ab9b5fc4637c1399f9",
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
    { name: "Zürich 1 (Youth)", zones: ["Team 1 Cell 1", "Team 1 Cell 2", "Team 1 Cell 3", "Team 1 Cell 4"] },
    { name: "Zürich 2 (Youth)", zones: ["Team 2 Cell 1", "Team 2 Cell 2", "Team 2 Cell 3", "Team 2 Cell 4 (Culture)"] },
    { name: "Zürich 3 (Youth)", zones: ["Team 3 Cell 1", "Team 3 Cell 2", "Team 3 Cell 3", "Team 3 Cell 4"] },
    { name: "Zürich 4 (Youth)", zones: ["Team 4 Cell 1", "Team 4 Cell 2", "Team 4 Cell 3", "Team 4 Cell 4"] },
    { name: "Newcomers Department", zones: ["Newcomers 1"] },
    { name: "Geneva", zones: ["Geneva Cell 1"] },
    { name: "Women's Group", zones: ["Women 1", "Women 2", "Women 3", "Women 4"] },
    { name: "Men's Group", zones: ["Men Cell 1", "Men Cell 2"] },
    { name: "Ministry of Theology", zones: ["Ministry of Theology"] },
  ],
};
