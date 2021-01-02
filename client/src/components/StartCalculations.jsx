import { Client } from "paho-mqtt";

import React from "react";
import Grid from '@material-ui/core/Grid';
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import Chart from "./Chart";



function StartGrowthRate(props){

  const [openSnackbar, setOpenSnackbar] = React.useState(false);
  const [snackbarMessage, setSnackbarMessage] = React.useState("");
  const [isClicked, setIsClicked] = React.useState(false);

  const onClick = (e) => {
    fetch("/run/growth_rate_calculating/$broadcast").then(r => {
      setSnackbarMessage("Growth rate calculating starting")
      setOpenSnackbar(true)
      setIsClicked(true)
    })
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return(
    <div>
      <p>Because of the varying strength & quality of the electronics, not all readings look the same - even for the same density of cells. So we compute a baseline measurement from the OD readings, and measure all growth against that baseline. </p>
      <p>From the (normalized) OD readings, we can calculate the <em>implied hourly growth rate</em>, which is our measure of growth. </p>
      <p>Let's start the growth rate calculations. This first computes the normalization constants, <b>which can take up to two minutes to complete</b>. After that, the graph below should start to populate.</p>
      <Button variant="contained"  color="primary" disabled={isClicked ? true : false } onClick={onClick}> Start growth rate calculations </Button>
      <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      onClose={handleSnackbarClose}
      message={snackbarMessage}
      autoHideDuration={7000}
      key={"snackbarGR"}
      />
  </div>
  )
}




function StartCalculations(props){
  const [experiment, setExperiment] = React.useState("null_exp")

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
    <Grid
      container
      direction="column"
      justify="flex-start"
      alignItems="center"
      spacing={2}
    >
      <Grid item xs={2}/>
      <Grid item xs={10}><StartGrowthRate experiment={experiment}/></Grid>
      <Grid item xs={12}>
      <Chart
        config={{}}
        interpolation="stepAfter"
        fontScale={1}
        title="Implied growth rate"
        topic="growth_rate"
        yAxisLabel="Growth rate, h⁻¹"
        experiment={experiment}
      />
      </Grid>
      <Grid item xs={2}/>
    </Grid>
)}


export default StartCalculations;
