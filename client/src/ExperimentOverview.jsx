import React from "react";

import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import LogTable from "./components/LogTable";
import ExperimentSummary from "./components/ExperimentSummary";
import Chart from "./components/Chart";
import MediaCard from "./components/MediaCard";
import PioreactorIcon from './components/PioreactorIcon';
import TactileButtonNotification from "./components/TactileButtonNotification";


function Overview(props) {

  const [experimentMetadata, setExperimentMetadata] = React.useState({})

  React.useEffect(() => {
    document.title = props.title;
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
  }, [props.title])


  return (
      <React.Fragment>
        <Grid container spacing={2} justify="space-between">

          <Grid item xs={12} md={12}>
            <ExperimentSummary experimentMetadata={experimentMetadata}/>
          </Grid>


          <Grid item xs={12} md={7} container spacing={2} justify="flex-start" style={{height: "100%"}}>


            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['implied_growth_rate'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                dataSource="growth_rates"
                title={props.config['ui.overview.settings']['doubling_time'] ?  "Implied doubling time" : "Implied growth rate"}
                topic="growth_rate_calculating/growth_rate"
                payloadKey="growth_rate"
                yAxisLabel={props.config['ui.overview.settings']['doubling_time'] ? "Doubling time, h" : "Growth rate, h⁻¹"}
                yTransformation={props.config['ui.overview.settings']['doubling_time'] ? (y) => 0.693147/Math.max(y, 0.01)  : (y) => y}
                experiment={experimentMetadata.experiment}
                deltaHours={experimentMetadata.delta_hours}
                interpolation="stepAfter"
                yAxisDomain={props.config['ui.overview.settings']['doubling_time'] ? null : [-0.02, 0.1]}
                lookback={100000}
                yAxisTickFormat={(t) => `${t.toFixed(2)}`}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['fraction_of_volume_that_is_alternative_media'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                yAxisDomain={[0.00, 0.05]}
                dataSource="alt_media_fraction"
                interpolation="stepAfter"
                payloadKey="alt_media_fraction"
                title="Fraction of volume that is alternative media"
                topic="alt_media_calculating/alt_media_fraction"
                yAxisLabel="Fraction"
                experiment={experimentMetadata.experiment}
                deltaHours={1} // hack to make all points display
                yAxisTickFormat={(t) => `${t.toFixed(3)}`}
                lookback={100000}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['normalized_optical_density'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                isODReading={true}
                dataSource="od_readings_filtered"
                title="Normalized optical density"
                payloadKey="od_filtered"
                topic="growth_rate_calculating/od_filtered/+"
                yAxisLabel="Current OD / initial OD"
                experiment={experimentMetadata.experiment}
                deltaHours={experimentMetadata.delta_hours}
                interpolation="stepAfter"
                lookback={parseFloat(props.config['ui.overview.settings']['filtered_od_lookback_hours'])}
                yAxisTickFormat={(t) => `${t.toFixed(2)}`}
              />
            </Grid>
            }

            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['raw_optical_density'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                isODReading={true}
                dataSource="od_readings_raw"
                title="Optical density"
                payloadKey="voltage"
                topic="od_reading/od_raw/+"
                yAxisLabel="Voltage"
                experiment={experimentMetadata.experiment}
                deltaHours={experimentMetadata.delta_hours}
                interpolation="stepAfter"
                lookback={parseFloat(props.config['ui.overview.settings']['raw_od_lookback_hours'])}
                yAxisTickFormat={(t) => `${t.toFixed(3)}`}
              />
            </Grid>
           }
            {( props.config['ui.overview.charts'] && (props.config['ui.overview.charts']['temperature'] === "1")) &&
            <Grid item xs={12}>
              <Chart
                config={props.config}
                dataSource="temperature_readings"
                title="Temperature of vials"
                topic="temperature_control/temperature"
                yAxisLabel="temperature, ℃"
                payloadKey="temperature"
                experiment={experimentMetadata.experiment}
                interpolation="stepAfter"
                lookback={10000}
                deltaHours={1} // hack to display all data points
                yAxisDomain={[22.5, 37.5]}
                yAxisTickFormat={(t) => `${t.toFixed(0)}`}
              />
            </Grid>
           }
          </Grid>

          <Grid item xs={12} md={5} container spacing={1} justify="flex-end" style={{height: "100%"}}>


            {( props.config['ui.overview.cards'] && (props.config['ui.overview.cards']['dosings'] === "1")) &&
              <Grid item xs={12} >
                <MediaCard experiment={experimentMetadata.experiment} config={props.config}/>
                <Button href="/pioreactors" color="primary" style={{textTransform: "none", verticalAlign: "middle", margin: "0px 3px"}}> <PioreactorIcon style={{ fontSize: 17 }} color="primary"/> See all Pioreactor details </Button>
              </Grid>
            }


            {( props.config['ui.overview.cards'] && (props.config['ui.overview.cards']['event_logs'] === "1")) &&
              <Grid item xs={12}>
                <LogTable experiment={experimentMetadata.experiment} config={props.config}/>
              </Grid>
            }

          </Grid>
        </Grid>
        {props.config['ui.rename'] ? <TactileButtonNotification config={props.config}/> : null}
      </React.Fragment>
  );
}
export default Overview;
