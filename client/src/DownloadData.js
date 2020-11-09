import React from "react";

import Grid from '@material-ui/core/Grid';
import Header from "./components/Header"

import CssBaseline from "@material-ui/core/CssBaseline";
import { MuiThemeProvider, createMuiTheme } from "@material-ui/core/styles";

import { makeStyles } from '@material-ui/core/styles';
import FormLabel from '@material-ui/core/FormLabel';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Checkbox from '@material-ui/core/Checkbox';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import Select from '@material-ui/core/Select';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/Select';
import InputLabel from '@material-ui/core/Select';
import Button from "@material-ui/core/Button";


const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
  formControl: {
    margin: theme.spacing(3),
  },
  root: {
    minWidth: 100,
    marginTop: "15px"
  },
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
}));


const themeLight = createMuiTheme({
  palette: {
    background: {
      default: "#fafbfc"
    }
  }
});



function ExperimentSelection(){
  const classes = useStyles();
  const chosenExperiment = "Trial-23"

  return (
    <div className={classes.root}>
      <FormControl component="fieldset" className={classes.formControl}>

        <FormLabel component="legend">Experiment</FormLabel>
        <span>{chosenExperiment}</span>
      </FormControl>
    </div>
  )
}



function CheckboxesGroup() {
  const classes = useStyles();
  const [state, setState] = React.useState({
    growthRate: false,
    ioEvents: false,
    odreadingRaw90: false,
    odreadingRaw135: false,
    odreadingFiltered90: false,
    odreadingFiltered135: false,
    log: false,
  });

  const handleChange = (event) => {
    setState({ ...state, [event.target.name]: event.target.checked });
  };

  return (
    <div className={classes.root}>
      <FormControl component="fieldset" className={classes.formControl}>
        <FormLabel component="legend">Datasets</FormLabel>
        <FormGroup>
          <FormControlLabel
            control={<Checkbox checked={state.growthRate} onChange={handleChange} name="growthRate" />}
            label="Growth rate"
          />
          <FormControlLabel
            control={<Checkbox checked={state.ioEvents} onChange={handleChange} name="ioEvents" />}
            label="IO Events"
          />
          <FormControlLabel
            control={<Checkbox checked={state.odreadingRaw90} onChange={handleChange} name="odreadingRaw90" />}
            label="Raw 90° OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={state.odreadingRaw135} onChange={handleChange} name="odreadingRaw135" />}
            label="Raw 135° OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={state.odreadingFiltered90} onChange={handleChange} name="odreadingFiltered90" />}
            label="Filtered 90° OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={state.odreadingFiltered135} onChange={handleChange} name="odreadingFiltered135" />}
            label="Filtered 135° OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={state.logs} onChange={handleChange} name="logs" />}
            label="Logs"
          />
        </FormGroup>
      </FormControl>
    </div>
)}


function DownloadDataForm() {
  const classes = useStyles();

  const onSubmit = (event) =>{

  }

  return (
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography variant="h5" component="h2">
          Download experiment data
        </Typography>

        <form>
          <Grid container spacing={1}>
            <Grid item xs={6}><CheckboxesGroup/></Grid>
            <Grid item xs={6}><ExperimentSelection/></Grid>

            <Grid item xs={9} />
            <Grid item xs={3}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                onClick={onSubmit}
              >
                Download
              </Button>
            </Grid>
            <Grid item xs={12}/>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )

}


function DownloadData() {
    return (
    <MuiThemeProvider theme={themeLight}>
      <CssBaseline />
      <div>
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item xs={3}/>
          <Grid item xs={6}>
            <div> <DownloadDataForm/> </div>
          </Grid>
          <Grid item xs={3}/>
        </Grid>
      </div>
    </MuiThemeProvider>
    )
}

export default DownloadData;

