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
          <Route path="/dashboard">
            <Dashboard />
          </Route>
          <Route path="/">
            <Dashboard />
          </Route>
          <Route path="/download-data">
            <DownloadData />
          </Route>
        </Switch>
      </div>
    </Router>
  );
}

export default App;
