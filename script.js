import { startSimone } from "./src/application/startSimone.js";
import {
    runModelCComparison
} from "./src/prototypes/model-c/runModelCComparison.js";

// Browser entry point only. Application coordination belongs in the application layer.
const application = startSimone();

// Temporary Model C measurement entry point for this prototype branch only.
window.runModelCComparison = () => runModelCComparison(application);
