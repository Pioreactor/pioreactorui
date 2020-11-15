import React from "react";

import Grid from "@material-ui/core/Grid";
import Header from "./components/Header";
import {UnitCards} from "./components/UnitCards";
import LogTable from "./components/LogTable";
import ExperimentSummary from "./components/ExperimentSummary";
import Chart from "./components/Chart";
import AllUnitsManagerCard from "./components/AllUnitsManagerCard";
import ClearChartButton from "./components/ClearChartButton";
import ClearLogButton from "./components/ClearLogButton";

import CssBaseline from "@material-ui/core/CssBaseline";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";

const themeLight = createMuiTheme({
  palette: {
    background: {
      default: "#fafbfc",
    },
  },
});

const experiment = "Trial-25"

function Dashboard() {
  return (
    <MuiThemeProvider theme={themeLight}>
      <CssBaseline />
      <div>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Header />
          </Grid>

          <Grid item xs={false} md={1}/>
          <Grid item xs={12} md={6} container direction="column" spacing={2}>
            <Grid item>
              <ExperimentSummary />
            </Grid>

            <Grid item>
              <Chart
                dataFile={"./data/growth_rate.json"}
                interpolation="stepAfter"
                fontScale={1}
                title="Implied growth rate"
                topic="growth_rate"
                yAxisLabel="Growth rate, h⁻¹"
                experiment={experiment}
              />
            </Grid>

            <Grid item >
              <Chart
                dataFile={"./data/alt_media_calculating_alt_media_fraction.json"}
                interpolation="stepAfter"
                fontScale={1}
                title="Fraction of volume that is alternative media"
                topic="alt_media_fraction"
                yAxisLabel="Fraction"
                experiment={experiment}
              />
            </Grid>

            <Grid item>
              <Chart
                isODReading={true}
                dataFile={"./data/od_filtered_135.json"}
                fontScale={1.0}
                interpolation="stepAfter"
                title="Filtered 135° optical density"
                topic="od_filtered/135/+"
                yAxisLabel="Current OD / initial OD"
                experiment={experiment}
              />
            </Grid>

            <Grid item >
              <Chart
                isODReading={true}
                dataFile={"./data/od_raw_135.json"}
                fontScale={1.0}
                interpolation="stepAfter"
                title="Raw 135° optical density"
                topic="od_raw/135/+"
                yAxisLabel="Voltage"
                experiment="+"
              />
            </Grid>
            <Grid item> <ClearChartButton /> </Grid>
          </Grid>

          <Grid item xs={12} md={4} container direction="column" spacing={2}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <UnitCards experiment={experiment} units={[1, 3, 5]} />
              </Grid>
              <Grid item xs={6}>
                <UnitCards experiment={experiment} units={[2, 4, 6]} />
              </Grid>
            </Grid>

              <Grid item style={{padding: "10px 0px"}}>
                <AllUnitsManagerCard experiment={experiment}/>
              </Grid>

            <Grid item style={{padding: "10px 0px"}}>
              <LogTable experiment={experiment} />
            </Grid>
            <Grid item> <ClearLogButton experiment={experiment}/> </Grid>
          </Grid>
          <Grid item xs={false} md={1}/>
        </Grid>
      </div>
    </MuiThemeProvider>
  );
}
export default Dashboard;
