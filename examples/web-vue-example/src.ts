import { createApp } from "vue";
import App from "./App.vue";
// oxlint-disable-next-line import/no-unassigned-import -- Vite applies global CSS via import.
import "./style.css";
createApp(App).mount("#app");
