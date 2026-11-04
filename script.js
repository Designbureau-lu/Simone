import { i18n } from "./src/i18n/i18n.js";
import { DEVELOPMENT_ENABLED, LEAFLET_PREVIEW_ENABLED } from "./src/config.js";
import { startSimone } from "./src/application/startSimone.js";
import {
    runModelCComparison
} from "./src/prototypes/model-c/runModelCComparison.js";
import {
    startCurtainEntrance
} from "./src/prototypes/arrival/startCurtainEntrance.js";
import {
    startIdentityBlobPresentation
} from "./src/prototypes/identity/startIdentityBlobPresentation.js";

// Browser entry point only. Application coordination belongs in the application layer.
const application = startSimone();
for (const preview of document.querySelectorAll("[data-leaflet-preview]")) {
    preview.hidden = !LEAFLET_PREVIEW_ENABLED;
}
void i18n.start();
startIdentityBlobPresentation();
startCurtainEntrance(application);

// Developer measurement entry point for SIMONE's viewport-canvas renderer.
if (DEVELOPMENT_ENABLED) {
    window.runModelCComparison = () => runModelCComparison(application);
}
