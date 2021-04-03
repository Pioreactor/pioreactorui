import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";

import TactileButtonNotification from "./components/TactileButtonNotification";
import ExperimentOverview from "./ExperimentOverview";
import ExportData from "./ExportData";
import Pioreactors from "./Pioreactors";
import StartNewExperiment from "./StartNewExperiment";
import EditConfig from "./EditConfig";
import Updates from "./Updates";

import "fontsource-roboto/300-normal.css"
import "fontsource-roboto/400-normal.css"
import "fontsource-roboto/500-normal.css"
import "fontsource-roboto/700-normal.css"
import './styles.css';
import {parseINIString} from "./utilities"


const theme = createMuiTheme({
  palette: {
    background: {
      default: "#f6f6f7",
    },
    primary: {
      // light: will be calculated from palette.primary.main,
      main: '#5331CA',
      // dark: will be calculated from palette.primary.main,
      // contrastText: will be calculated to contrast with palette.primary.main
    },
  },
});



function App() {

  const [config, setConfig] = React.useState({})

  React.useEffect(() => {

    async function getConfig() {
      await fetch("/get_config/config.ini")
        .then((response) => {
            if (response.ok) {
              return response.text();
            } else {
              throw new Error('Something went wrong');
            }
          })
        .then((config) => {
          setConfig(parseINIString(config)); // TODO: parse on server side and send a json object
        })
        .catch((error) => {})
    }
    getConfig();
  }, [])

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="pageContainer">
          <Switch>
            <Route path="/export-data">
              <ExportData config={config} title="Pioreactor ~ Export data"/>
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/start-new-experiment">
              <StartNewExperiment config={config} title="Pioreactor ~ Start new experiment" />
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/overview">
              <ExperimentOverview config={config} title="Pioreactor ~ Overview"/>
            </Route>
            <Route path="/config">
              <EditConfig config={config} title="Pioreactor ~ Configuration"/>
              <TactileButtonNotification config={config}/>
            </Route>f
            <Route path="/pioreactors">
              <Pioreactors config={config} title="Pioreactor ~ Pioreactors"/>
            </Route>
            <Route path="/Updates">
              <Updates config={config} title="Pioreactor ~ Updates"/>
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/">
              <ExperimentOverview config={config} title="Pioreactor ~ Pioreactor"/>
            </Route>
          </Switch>
        </div>
      </Router>
    </MuiThemeProvider>
  );
}

export default App;
