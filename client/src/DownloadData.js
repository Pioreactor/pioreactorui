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
    marginTop: "15px"
  },
  formControl: {
    margin: theme.spacing(3),
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



const ExperimentSelection = (props) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <FormControl component="fieldset" className={classes.formControl}>

        <FormLabel component="legend">Experiment</FormLabel>
        <span>{props.chosenExperiment}</span>
      </FormControl>
    </div>
  )
}



const CheckboxesGroup = (props) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <FormControl component="fieldset" className={classes.formControl}>
        <FormLabel component="legend">Datasets</FormLabel>
        <FormGroup>
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.growth_rates} onChange={props.handleChange} name="growth_rates" />}
            label="Growth rate"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.io_events} onChange={props.handleChange} name="io_events" />}
            label="IO Events"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.od_readings_raw} onChange={props.handleChange} name="od_readings_raw" />}
            label="Raw OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.od_readings_filtered} onChange={props.handleChange} name="od_readings_filtered" />}
            label="Filtered OD readings"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.logs} onChange={props.handleChange} name="logs" />}
            label="Logs"
          />
        </FormGroup>
      </FormControl>
    </div>
)}


function DownloadDataFormContainer() {
  const classes = useStyles();
  const [state, setState] = React.useState({
    experimentSelection: "Trial-25",
    datasetCheckbox: {
      growth_rates: false,
      io_events: false,
      od_readings_raw: false,
      od_readings_filtered: false,
      logs: false,
    }
  });

  const onSubmit = (event) =>{
    event.preventDefault()
    fetch('query_datasets',{
        method: "POST",
        body: JSON.stringify(state),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
    }).then(req => {
      fetch("/download_data").then({})

    })
  }

  const handleCheckboxChange = (event) => {
    setState(prevState => ({
      ...prevState,
      datasetCheckbox: {...state.datasetCheckbox, [event.target.name]: event.target.checked }
    }));
  };

  const handleExperimentSelectionChange = (event) => {
    setState(prevState => ({
      ...prevState,
      experimentSelection: event.target.value
    }));
  };

  return (
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography variant="h5" component="h2">
          Download experiment data
        </Typography>

        <form>
          <Grid container spacing={1}>
            <Grid item xs={12} md={6}>
              <CheckboxesGroup
              isChecked={state.datasetCheckbox}
              handleChange={handleCheckboxChange}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <ExperimentSelection
              chosenExperiment={state.experimentSelection}
              handleChange={handleExperimentSelectionChange}
              />
            </Grid>

            <Grid item xs={false} md={9} />
            <Grid item xs={12} md={3}>
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
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item xs={3}/>
          <Grid item xs={6}>
            <div> <DownloadDataFormContainer/> </div>
          </Grid>
          <Grid item xs={3}/>
        </Grid>
    </MuiThemeProvider>
    )
}

export default DownloadData;

