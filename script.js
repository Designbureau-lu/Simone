import { startSimone } from "./src/application/startSimone.js";
import {
    runModelCComparison
} from "./src/prototypes/model-c/runModelCComparison.js";

// Browser entry point only. Application coordination belongs in the application layer.
const application = startSimone();

// Developer measurement entry point for SIMONE's viewport-canvas renderer.
window.runModelCComparison = () => runModelCComparison(application);
