import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import ExperimentOverview from "./ExperimentOverview";
import DownloadData from "./DownloadData";
import StartNewExperiment from "./StartNewExperiment";
import EditConfig from "./EditConfig";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";
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
            </Route>
            <Route path="/start-new-experiment">
              <StartNewExperiment />
            </Route>
            <Route path="/overview">
              <ExperimentOverview />
            </Route>
            <Route path="/edit-config">
              <EditConfig />
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
