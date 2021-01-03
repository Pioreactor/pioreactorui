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

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <div className="pageContainer">
          <Switch>
            <Route path="/download-data">
              <DownloadData />
              <TactileButtonNotification/>
            </Route>
            <Route path="/start-new-experiment">
              <StartNewExperiment />
              <TactileButtonNotification/>
            </Route>
            <Route path="/overview">
              <ExperimentOverview />
            </Route>
            <Route path="/edit-config">
              <EditConfig />
              <TactileButtonNotification/>
            </Route>
            <Route path="/pioreactors">
              <Pioreactors />
            </Route>
            <Route path="/">
              <ExperimentOverview />
            </Route>
          </Switch>
        </div>
      </Router>
    </MuiThemeProvider>
  );
}

export default App;
