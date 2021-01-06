import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
import Snackbar from '@material-ui/core/Snackbar';
import { makeStyles } from '@material-ui/core/styles';

import TactileButtonNotification from "./components/TactileButtonNotification";
import ExperimentOverview from "./ExperimentOverview";
import DownloadData from "./DownloadData";
import Pioreactors from "./Pioreactors";
import StartNewExperiment from "./StartNewExperiment";
import EditConfig from "./EditConfig";

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
            <Route path="/download-data">
              <DownloadData config={config}/>
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/start-new-experiment">
              <StartNewExperiment config={config}/>
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/overview">
              <ExperimentOverview config={config}/>
            </Route>
            <Route path="/edit-config">
              <EditConfig config={config}/>
              <TactileButtonNotification config={config}/>
            </Route>
            <Route path="/pioreactors">
              <Pioreactors config={config}/>
            </Route>
            <Route path="/">
              <ExperimentOverview config={config}/>
            </Route>
          </Switch>
        </div>
      </Router>
    </MuiThemeProvider>
  );
}

export default App;
