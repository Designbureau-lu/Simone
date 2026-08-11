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
startIdentityBlobPresentation();
startCurtainEntrance(application);

// Developer measurement entry point for SIMONE's viewport-canvas renderer.
window.runModelCComparison = () => runModelCComparison(application);
