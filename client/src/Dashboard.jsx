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



function Dashboard() {

  const [experiment, setExperiment] = React.useState("")

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_latest_experiment")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setExperiment(data.experiment)
        });
      }
      getData()
  }, [])

  return (
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
                dataFile={"./data/growth_rate_time_series_aggregating.json"}
                interpolation="stepAfter"
                title="Implied growth rate"
                topic="growth_rate"
                yAxisLabel="Growth rate, h⁻¹"
                experiment={experiment}
              />
            </Grid>

            <Grid item >
              <Chart
                dataFile={"./data/alt_media_fraction_time_series_aggregating.json"}
                interpolation="stepAfter"
                title="Fraction of volume that is alternative media"
                topic="alt_media_calculating/alt_media_fraction"
                yAxisLabel="Fraction"
                experiment={experiment}
              />
            </Grid>

            <Grid item>
              <Chart
                isODReading={true}
                dataFile={"./data/od_filtered_time_series_aggregating.json"}
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
                dataFile={"./data/od_raw_time_series_aggregating.json"}
                interpolation="stepAfter"
                title="Raw 135° optical density"
                topic="od_raw/135/+"
                yAxisLabel="Voltage"
                experiment="+"
              />
            </Grid>
            <Grid item> <ClearChartButton experiment={experiment}/> </Grid>
          </Grid>

          <Grid item xs={12} md={4} container direction="column" spacing={2}>
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <UnitCards experiment={experiment} units={["1", "3", "5"]} />
              </Grid>
              <Grid item xs={6}>
                <UnitCards experiment={experiment} units={["2", "4", "6"]} />
              </Grid>
            </Grid>

              <Grid item style={{padding: "10px 0px"}}>
                <AllUnitsManagerCard experiment={experiment}/>
              </Grid>

            <Grid item style={{padding: "10px 0px"}}>
              <LogTable />
            </Grid>
            <Grid item> <ClearLogButton /> </Grid>
          </Grid>
          <Grid item xs={false} md={1}/>
        </Grid>
      </div>
  );
}
export default Dashboard;
