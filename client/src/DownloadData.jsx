import React from "react";
import moment from "moment";

import Grid from '@material-ui/core/Grid';
import Header from "./components/Header"

import { makeStyles } from '@material-ui/core/styles';
import FormLabel from '@material-ui/core/FormLabel';
import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Checkbox from '@material-ui/core/Checkbox';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import Select from '@material-ui/core/Select';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
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



function ExperimentSelection(props) {
  const classes = useStyles();

  const [experiments, setExperiments] = React.useState([])

  React.useEffect(() => {
    async function getData() {
         await fetch("/get_experiments")
        .then((response) => {
          return response.json();
        })
        .then((data) => {
          setExperiments(data)
          props.handleChange(data[0].experiment)
        });
      }
      getData()
  }, [])

  const handleExperimentSelectionChange = (e) => {
    props.handleChange(e.target.value)
  }

  return (
    <div className={classes.root}>
      <FormControl component="fieldset" className={classes.formControl}>

      <FormLabel component="legend">Experiment</FormLabel>
        <Select
          native
          value={props.ExperimentSelection}
          onChange={handleExperimentSelectionChange}
          inputProps={{
            name: 'experiment',
            id: 'experiment',
          }}
        >
          {experiments.map((v) => {
            return <option value={v.experiment}>{v.experiment +  ` (started ${moment(v.timestamp).format("MMMM D, YYYY")})`}</option>
            }
          )}
        </Select>
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
            label="Implied growth rate"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.io_events} onChange={props.handleChange} name="io_events" />}
            label="Input/output (dosing) events log"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.experiments} onChange={props.handleChange} name="experiments" />}
            label="Experiment description"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.od_readings_raw} onChange={props.handleChange} name="od_readings_raw" />}
            label="Raw optical density"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.od_readings_filtered} onChange={props.handleChange} name="od_readings_filtered" />}
            label="Normalized optical density"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.logs} onChange={props.handleChange} name="logs" />}
            label="Logs"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.alt_media_fraction} onChange={props.handleChange} name="alt_media_fraction" />}
            label="Alternative media fraction"
          />
          <FormControlLabel
            control={<Checkbox checked={props.isChecked.io_algorithm_settings} onChange={props.handleChange} name="io_algorithm_settings" />}
            label="IO algorithm change log"
          />
        </FormGroup>
      </FormControl>
    </div>
)}


function DownloadDataFormContainer() {
  const classes = useStyles();
  const [isRunning, setIsRunning] = React.useState(false)
  const [isError, setIsError] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [state, setState] = React.useState({
    experimentSelection: "",
    datasetCheckbox: {
      growth_rates: false,
      io_events: false,
      experiments: false,
      od_readings_raw: false,
      od_readings_filtered: false,
      logs: false,
      alt_media_fraction: false,
      io_algorithm_settings: false,
    }
  });

  const onSubmit = (event) =>{
    event.preventDefault()

    if (!Object.values(state['datasetCheckbox']).some((e) => e)) {
      setIsError(true)
      setErrorMsg("At least one dataset must be selected.")
      return
    }

    setIsRunning(true)
    fetch('query_datasets',{
        method: "POST",
        body: JSON.stringify(state),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
    }).then(res => res.json())
      .then(res => {
      var link = document.createElement("a");
      link.setAttribute('download', res['filename']);
      link.href = "/static/exports/" + res['filename'];
      document.body.appendChild(link);
      link.click();
      link.remove();
      setIsRunning(false)
    }).catch(e => {
      setIsRunning(false)
      setIsError(true)
      setErrorMsg("Server error occurred. Check logs.")
    });
  }

  const handleCheckboxChange = (event) => {
    setState(prevState => ({
      ...prevState,
      datasetCheckbox: {...state.datasetCheckbox, [event.target.name]: event.target.checked }
    }));
  };

  function handleExperimentSelectionChange(value) {
    setState(prevState => ({
      ...prevState,
      experimentSelection: value
    }));
  };

  const runningFeedback = isRunning ? <CircularProgress color="white" size={20}/> : "Download"
  const errorFeedbackOrDefault = isError ? errorMsg : "Querying large tables may take up to a minute or so."
  return (
    <>
      <div>
        <div>
          <Typography variant="h5" component="h1">
            <Box fontWeight="fontWeightBold">
              Download Experiment Data
            </Box>
          </Typography>
        </div>

      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <form>
            <Grid container spacing={1}>
              <Grid item xs={12} md={12}>
                <ExperimentSelection
                experimentSelection={state.experimentSelection}
                handleChange={handleExperimentSelectionChange}
                />
              </Grid>
              <Grid item xs={12} md={12}>
                <CheckboxesGroup
                isChecked={state.datasetCheckbox}
                handleChange={handleCheckboxChange}
                />
              </Grid>

              <Grid item xs={0}/>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  onClick={onSubmit}
                  style={{width: "120px", marginLeft: 24}}
                >
                  {runningFeedback}
                </Button>
                <p style={{marginLeft: 24}}>{errorFeedbackOrDefault}</p>

              </Grid>
              <Grid item xs={12}/>
            </Grid>
          </form>
        </CardContent>
      </Card>
  </>
  )
}


function DownloadData() {
    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item xs={12} />
          <Grid item xs={12} />

          <Grid item md={1} xs={1}/>
          <Grid item md={10} xs={12}>
            <DownloadDataFormContainer/>
          </Grid>
          <Grid item md={1} xs={1}/>
        </Grid>
    )
}

export default DownloadData;

