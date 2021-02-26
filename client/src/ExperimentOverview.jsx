import React from "react";

import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Header from "./components/Header";
import LogTable from "./components/LogTable";
import ExperimentSummary from "./components/ExperimentSummary";
import Chart from "./components/Chart";
import MediaCard from "./components/MediaCard";
import ClearChartButton from "./components/ClearChartButton";
import ClearLogButton from "./components/ClearLogButton";
import PioreactorIcon from './components/PioreactorIcon';
import TactileButtonNotification from "./components/TactileButtonNotification";


function Overview(props) {

  const [experimentMetadata, setExperimentMetadata] = React.useState({})

  React.useEffect(() => {
    async function getLatestExperiment() {
         await fetch("/get_latest_experiment")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setExperimentMetadata(data)
        });
      }
    getLatestExperiment()
  }, [])

  return (
      <React.Fragment>
        <Grid container spacing={2} justify="space-between">
          <Grid item xs={12} style={{paddingRight: "0px"}}>
            <Header />
          </Grid>
          <Grid item xs={1} md={12}/>
          <Grid item xs={1} md={12}/>


          <Grid item xs={12} md={1}/>
          <Grid item xs={12} md={10}>
            <ExperimentSummary experimentMetadata={experimentMetadata}/>
          </Grid>
          <Grid item xs={12} md={1}/>


          <Grid item xs={12} md={1}/>
          <Grid item xs={12} md={6} container spacing={2} justify="flex-start" style={{paddingLeft: 0, height: "100%"}}>


            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['implied_growth_rate'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                dataFile={"./data/growth_rate_time_series_aggregating.json"}
                title="Implied growth rate"
                topic="growth_rate"
                yAxisLabel="Growth rate, h⁻¹"
                experiment={experimentMetadata.experiment}
                interpolation="stepAfter"
                yAxisDomain={[-0.01, 0.1]}
                yAxisTickFormat={(t) => `${t.toFixed(2)}`}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['fraction_of_volume_that_is_alternative_media'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                domain={[0, 1]}
                dataFile={"./data/alt_media_fraction_time_series_aggregating.json"}
                interpolation="stepAfter"
                title="Fraction of volume that is alternative media"
                topic="alt_media_calculating/alt_media_fraction"
                yAxisLabel="Fraction"
                experiment={experimentMetadata.experiment}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['normalized_optical_density'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                isODReading={true}
                dataFile={"./data/od_filtered_time_series_aggregating.json"}
                title="Normalized optical density"
                topic="od_filtered/+/+"
                yAxisLabel="Current OD / initial OD"
                experiment={experimentMetadata.experiment}
                interpolation="stepAfter"
                yAxisTickFormat={(t) => `${t.toFixed(2)}`}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['raw_optical_density'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                isODReading={true}
                dataFile={"./data/od_raw_time_series_aggregating.json"}
                title="Raw optical density"
                topic="od_raw/+/+"
                yAxisLabel="Voltage"
                experiment="+"
                interpolation="stepAfter"
              />
            </Grid>
           }
            <Grid item xs={12}> <ClearChartButton config={props.config} experiment={experimentMetadata.experiment}/> </Grid>
          </Grid>

          <Grid item xs={12} md={4} container spacing={2} justify="flex-end" style={{height: "100%"}}>


            {( props.config['ui.overview.cards'] && (props.config['ui.overview.cards']['dosings'] === "1")) &&
              <Grid item xs={12} style={{padding: "10px 0px"}}>
                <MediaCard experiment={experimentMetadata.experiment} config={props.config}/>
                <Button href="/pioreactors" color="primary" style={{textTransform: "none", verticalAlign: "middle", margin: "0px 3px"}}> <PioreactorIcon style={{ fontSize: 17 }} color="primary"/> See all Pioreactor details </Button>
              </Grid>
            }


            {( props.config['ui.overview.cards'] && (props.config['ui.overview.cards']['event_logs'] === "1")) &&
              <Grid item xs={12} style={{padding: "10px 0px"}}>
                <LogTable config={props.config}/>
                <ClearLogButton config={props.config} />
              </Grid>
            }


          </Grid>

          <Grid item xs={1} md={1}/>
        </Grid>
        {props.config['ui.rename'] ? <TactileButtonNotification config={props.config}/> : null}
      </React.Fragment>
  );
}
export default Overview;
