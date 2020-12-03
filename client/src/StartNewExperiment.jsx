import React from "react";
import moment from "moment";
import { Client, Message } from "paho-mqtt";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import FormGroup from '@material-ui/core/FormGroup';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import Button from "@material-ui/core/Button";
import Stepper from '@material-ui/core/Stepper';
import Step from '@material-ui/core/Step';
import StepLabel from '@material-ui/core/StepLabel';
import TextField from '@material-ui/core/TextField';
import Snackbar from '@material-ui/core/Snackbar';

import Header from "./components/Header"
import CleaningScript from "./components/CleaningScript"
import StartSensors from "./components/StartSensors"
import StartCalculations from "./components/StartCalculations"


const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: "15px"
  },
  cardContent: {
    padding: "10px"
  },
  button: {
    marginRight: theme.spacing(1),
  },
  instructions: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(4),
    marginLeft: "auto",
    marginRight: "auto",
    width: "60%"
  },
  textField:{
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  formControl: {
    margin: theme.spacing(3),
  },
  halfTextField: {
    width: "95%"
  },
}));




function ExperimentSummaryForm(props) {
  const classes = useStyles();
  const [openSnackbar, setOpenSnackbar] = React.useState(false);
  const [formError, setFormError] = React.useState(false);
  const [expName, setExpName] = React.useState("");
  const [timestamp, setTimestamp] = React.useState(moment().format("YYYY-MM-DDTHH:mm:ss"));
  const [description, setDescription] = React.useState("");


  function publishExpNameToMQTT(){

    function onConnect() {
      var message = new Message(expName);
      message.destinationName = "pioreactor/latest_experiment"
      message.qos = 1;
      message.retained = true;
      client.publish(message);
    }

    var client = new Client(
      "ws://pioreactorws.ngrok.io/",
      "webui" + Math.random()
    );
    client.connect({ onSuccess: onConnect });

  }

  function onSubmit(e) {
    e.preventDefault();
    if (expName === ""){
      setFormError(true)
      return
    }
    fetch('create_experiment',{
        method: "POST",
        body: JSON.stringify({experiment : expName, timestamp: timestamp, description: description}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(res => {
        if (res.status === 200){
          setFormError(false);
          setOpenSnackbar(true);
          publishExpNameToMQTT()
        }
        else{
          setFormError(true);
        }
      }
     )
  }

  const onExpNameChange = (e) => {
    setExpName(e.target.value)
  }
  const onDescChange = (e) => {
    setDescription(e.target.value)
  }
  const onTimestampChange = (e) => {
    setTimestamp(e.target.value)
  }

  const handleSnackbarClose = () => {
    setOpenSnackbar(false);
  };

  return (
    <div className={classes.root}>
        <FormGroup>
        <Grid container spacing={1}>
          <Grid item xs={12} md={6}>
            <TextField
              error={formError}
              id="expName"
              label="Experiment name"
              required className={`${classes.halfTextField} ${classes.textField}`}
              onChange={onExpNameChange}
              />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              id="datetime"
              label="Start time"
              type="datetime-local"
              defaultValue={timestamp}
              className={`${classes.halfTextField} ${classes.textField}`}
              onChange={onTimestampChange}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Grid>
          <Grid item xs={12} md={12}>
            <TextField
              label="Description"
              rowsMax={4}
              placeholder={"Add a description: what microbe are you using? What is the media composition? This description can always be changed later."}
              multiline
              className={classes.textField}
              onChange={onDescChange}
              fullWidth={true}
            />
          </Grid>
          <Grid item xs={12} md={10}/>
          <Grid item xs={12} md={2}>
            <Button variant="contained" color="primary" onClick={onSubmit}> Create </Button>
            <Snackbar
              anchorOrigin={{vertical: "bottom", horizontal: "center"}}
              open={openSnackbar}
              onClose={handleSnackbarClose}
              message={"Created new experiment"}
              autoHideDuration={7000}
              key={"snackbar" + props.unitNumber + props.action}
            />
          </Grid>
        </Grid>
        </FormGroup>
    </div>
  )
}



function getSteps() {
  return [
    {title: 'Experiment summary', content: <ExperimentSummaryForm/>, optional: true},
    {title: 'Cleaning and preparation', content: <CleaningScript/>, optional: true},
    {title: 'Start sensors', content: <StartSensors/>, optional: true},
    {title: 'Start calculations', content: <StartCalculations/>, optional: false},
  ];
}



function StartNewExperimentContainer() {
  const classes = useStyles();
  const [activeStep, setActiveStep] = React.useState(0);
  const [skipped, setSkipped] = React.useState(new Set());
  const steps = getSteps();

  const getStepContent = (index) => {
    return steps[index].content
  }
  const isStepOptional = (index) => {
    return steps[index].optional
  };

  const isStepSkipped = (step) => {
    return skipped.has(step);
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1){
      window.location.href = "/dashboard";
    } else {

      let newSkipped = skipped;
      if (isStepSkipped(activeStep)) {
        newSkipped = new Set(newSkipped.values());
        newSkipped.delete(activeStep);
      }

      setActiveStep((prevActiveStep) => prevActiveStep + 1);
      setSkipped(newSkipped);
      window.scrollTo({top: 0})
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSkip = () => {
    if (!isStepOptional(activeStep)) {
      throw new Error("You can't skip a step that isn't optional.");
    }

    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  return (
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography variant="h5" component="h2">
          Start a new experiment
        </Typography>
        <Stepper activeStep={activeStep}>
          {steps.map((step, index) => {
            const stepProps = {};
            const labelProps = {};
            if (step.optional) {
              labelProps.optional = <Typography variant="caption">Optional</Typography>;
            }
            if (isStepSkipped(index)) {
              stepProps.completed = false;
            }
            return (
              <Step key={step.title} {...stepProps}>
                <StepLabel {...labelProps}>{step.title}</StepLabel>
              </Step>
            );
          })}
        </Stepper>
        <div>
          {activeStep === steps.length ? (
            <div>
              <Typography className={classes.instructions}>
                All steps completed - you&apos;re finished
              </Typography>
              <Button onClick={handleReset} className={classes.button}>
                Reset
              </Button>
            </div>
          ) : (
            <div>
              <Typography className={classes.instructions}>{getStepContent(activeStep)}</Typography>
              <div>
                <Button disabled={activeStep === 0} onClick={handleBack} className={classes.button}>
                  Back
                </Button>
                {isStepOptional(activeStep) && (
                  <Button
                    variant="contained"
                    onClick={handleSkip}
                    className={classes.button}
                  >
                    Skip
                  </Button>
                )}

                <Button
                  variant="contained"
                  onClick={handleNext}
                  className={classes.button}
                >
                  {activeStep === steps.length - 1 ? 'Go to dashboard' : 'Next'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}



function StartNewExperiment() {
    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>

          <Grid item xs={1}/>
          <Grid item xs={10}>
            <div><StartNewExperimentContainer/></div>
          </Grid>
          <Grid item xs={1}/>
        </Grid>
    )
}

export default StartNewExperiment;

