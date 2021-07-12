import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { ThemeProvider } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import { createTheme } from '@material-ui/core/styles';
import { StyledEngineProvider } from '@material-ui/core/styles';


import TactileButtonNotification from "./components/TactileButtonNotification";
import ExperimentOverview from "./ExperimentOverview";
import ExportData from "./ExportData";
import Pioreactors from "./Pioreactors";
import StartNewExperiment from "./StartNewExperiment";
import EditConfig from "./EditConfig";
import Updates from "./Updates";
import Plugins from "./Plugins";
import Analysis from "./Analysis";
import Feedback from "./Feedback";
import SideNavAndHeader from "./components/SideNavAndHeader";

import "@fontsource/roboto/300.css"
import "@fontsource/roboto/400.css"
import "@fontsource/roboto/500.css"
import "@fontsource/roboto/700.css"
import './styles.css';
import {parseINIString} from "./utilities"


const theme = createTheme({
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
    secondary: {
      main: '#f44336',
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
    <React.StrictMode>
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{display: 'flex'}}>
          <SideNavAndHeader />
          <main style={{flexGrow: 1, paddingTop: theme.spacing(9), paddingLeft: theme.spacing(4), paddingRight: theme.spacing(4)}}>
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
                  <Route path="/plugins">
                    <Plugins config={config} title="Pioreactor ~ Plugins"/>
                    <TactileButtonNotification config={config}/>
                  </Route>
                  <Route path="/analysis">
                    <Analysis config={config} title="Pioreactor ~ Analysis"/>
                    <TactileButtonNotification config={config}/>
                  </Route>
                  <Route path="/config">
                    <EditConfig config={config} title="Pioreactor ~ Configuration"/>
                    <TactileButtonNotification config={config}/>
                  </Route>
                  <Route path="/pioreactors">
                    <Pioreactors config={config} title="Pioreactor ~ Pioreactors"/>
                  </Route>
                  <Route path="/updates">
                    <Updates config={config} title="Pioreactor ~ Updates"/>
                    <TactileButtonNotification config={config}/>
                  </Route>
                  <Route path="/feedback">
                    <Feedback config={config} title="Pioreactor ~ Feedback"/>
                    <TactileButtonNotification config={config}/>
                  </Route>
                  <Route path="/">
                    <ExperimentOverview config={config} title="Pioreactor ~ Pioreactor"/>
                  </Route>
                </Switch>
              </div>
            </Router>
          </main>
        </div>
      </ThemeProvider>
    </StyledEngineProvider>
    </React.StrictMode>
  );
}

export default App;
