import React from "react";
import { BrowserRouter as Router, Switch, Route, Link } from "react-router-dom";
//import { About } from "./About";
import Dashboard from "./Dashboard";
import DownloadData from "./DownloadData";

function App() {
  return (
    <Router>
      <div className="pageContainer">
        <Switch>
          <Route path="/download-data">
            <DownloadData />
          </Route>
          <Route path="/dashboard">
            <Dashboard />
          </Route>
          <Route path="/">
            <Dashboard />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

export default App;
