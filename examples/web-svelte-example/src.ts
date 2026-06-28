import { mount } from "svelte";
import App from "./App.svelte";
// oxlint-disable-next-line import/no-unassigned-import -- Vite applies global CSS via import.
import "./style.css";
mount(App, { target: document.getElementById("app")! });
