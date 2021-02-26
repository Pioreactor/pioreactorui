import React from "react";
import Grid from '@material-ui/core/Grid';
import Button from "@material-ui/core/Button";
import Snackbar from "@material-ui/core/Snackbar";
import Chart from "./Chart";



function StartStirringButton(props){

  const [isClicked, setIsClicked] = React.useState(false)
  const [openSnackbar, setOpenSnackbar] = React.useState(false);

  const onClick = (e) => {
    setIsClicked(true)
    fetch("/run/stirring/$broadcast").then(res => {
      if (res.status === 200){
        setOpenSnackbar(true);
      }
    })
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return(
    <div>
      <p> To get an accurate reading, we need to start start the stirring. This also provides gas transfer and keeps the cells in suspension.</p>
      <Button variant="contained"  color="primary" disabled={isClicked ? true : false } onClick={onClick}> Start stirring </Button>
      <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      onClose={handleSnackbarClose}
      message={"Stirring starting"}
      autoHideDuration={7000}
      key={"snackbarStirring"}
    />
  </div>
  )
}


function StartODReading(props){

  const [isClicked, setIsClicked] = React.useState(false)
  const [openSnackbar, setOpenSnackbar] = React.useState(false);

  const onClick = (e) => {
    setIsClicked(true)
    fetch("/run/od_reading/$broadcast").then(res => {
      if (res.status === 200){
        setOpenSnackbar(true);
      }
    })
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return(
    <div>
      <p> Next, we will turn on the optical density reading. We also call this <em>OD readings</em>. This will provide us with a measure of cell density. After a minute or so, you should see the data in the chart below. </p>
      <Button variant="contained"  color="primary" disabled={isClicked ? true : false } onClick={onClick}> Start OD readings </Button>
      <Snackbar
      anchorOrigin={{vertical: "bottom", horizontal: "center"}}
      open={openSnackbar}
      onClose={handleSnackbarClose}
      message={"OD reading starting"}
      autoHideDuration={7000}
      key={"snackbarOD"}
    />
  </div>
  )
}


function StartSensors(props){


  return (
    <Grid
      container
      direction="column"
      justify="flex-start"
      alignItems="center"
      spacing={2}
    >
      <Grid item xs={2}/>
      <Grid item xs={10}><StartStirringButton/></Grid>
      <Grid item xs={10}><StartODReading/></Grid>
      <Grid item xs={12}>
        <Chart
          config={props.config}
          isODReading={true}
          fontScale={1.0}
          interpolation="stepAfter"
          title="Raw 135° optical density"
          topic="od_raw/+/+"
          yAxisLabel="Voltage"
          experiment="+"
        />
      </Grid>
      <Grid item xs={2}/>
    </Grid>
)}


export default StartSensors;
