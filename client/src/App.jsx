import React from "react";
import { BrowserRouter as Router, Switch, Route } from "react-router-dom";
import Dashboard from "./Dashboard";
import DownloadData from "./DownloadData";
import StartNewExperiment from "./StartNewExperiment";
import EditConfig from "./EditConfig";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";
import CssBaseline from "@material-ui/core/CssBaseline";


const theme = createMuiTheme({
  palette: {
    background: {
      default: "#f6f6f7",
    },
    primary: {
      // light: will be calculated from palette.primary.main,
      main: '#673ab7',
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
            <Route path="/dashboard">
              <Dashboard />
            </Route>
            <Route path="/edit-config">
              <EditConfig />
            </Route>
            <Route path="/">
              <Dashboard />
            </Route>
          </Switch>
        </div>
      </Router>
    </MuiThemeProvider>
  );
}

export default App;
