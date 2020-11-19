import React from "react";
import Grid from '@material-ui/core/Grid';
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import Chart from "./Chart";



function StartGrowthRate(props){

  const [isClicked, setIsClicked] = React.useState(false)
  const [openSnackbar, setOpenSnackbar] = React.useState(false);

  const onClick = (e) => {
    setIsClicked(true)
    fetch("/run/growth_rate_calculating/$broadcast").then(r => {
      setOpenSnackbar(true)
    })
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return(
    <div>
      <p>From the (normalized) OD readings, we can calculate the <em>implied hourly growth rate</em>, which is our measure of growth. For morbidostats, this is the metric we with to target.</p>
      <p>Let's start the growth rate calculations. The graph below should start to populate.</p>
      <Button variant="contained"  color="primary" disabled={isClicked ? true : false } onClick={onClick}> Start growth rate calculations </Button>
      <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      onClose={handleSnackbarClose}
      message={"Growth rate job started"}
      autoHideDuration={7000}
      key={"snackbarOD"}
    />
  </div>
  )
}


function StartODNormalization(props){

  const [isClicked, setIsClicked] = React.useState(false)
  const [openSnackbar, setOpenSnackbar] = React.useState(false);

  const onClick = (e) => {
    setIsClicked(true)
    fetch("/run/od_normalization/$broadcast").then(r => {
      setOpenSnackbar(true)
    })
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return(
    <div>
      <p>Because of the varying strength & quality of the electronics, not all readings look the same - even for the same density of cells. So we compute a baseline measurement from the above raw OD readings, and measure all growth against that. </p>
      <p>Let's go ahead and compute those normalization measurements now. This may take up to 3 minutes to get enough samples.</p>
      <Button variant="contained"  color="primary" disabled={isClicked ? true : false } onClick={onClick}> Compute normalization measurements </Button>
      <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      onClose={handleSnackbarClose}
      message={"Computing OD normalization"}
      autoHideDuration={7000}
      key={"snackbarOD"}
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
      <Grid item xs={10}><StartODNormalization/></Grid>
      <Grid item xs={10}><StartGrowthRate/></Grid>
      <Grid item xs={12}>
      <Chart
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
