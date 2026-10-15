
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyC-F_D13-KRZBq1djfU6H9y4zB8yKR3U6E",
  authDomain: "calypso-bar.firebaseapp.com",
  projectId: "calypso-bar",
  storageBucket: "calypso-bar.firebasestorage.app",
  messagingSenderId: "695936854778",
  appId: "1:695936854778:web:cbadc99cfafc7553e17743",
  measurementId: "G-NN83N0PDGW"
};

// Cuentas autorizadas para administrar CALYPSO BAR
export const ADMIN_EMAIL = "publicidadherrera@gmail.com";
export const SECOND_ADMIN_EMAIL = "simonretaherre@gmail.com";

// Inicialización compartida de Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
