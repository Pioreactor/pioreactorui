import React from "react";
import { Client, Message } from "paho-mqtt";
import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import LoadingButton from '@material-ui/lab/LoadingButton';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import FormGroup from '@material-ui/core/FormGroup';
import TextField from '@material-ui/core/TextField';


const useStyles = makeStyles((theme) => ({
  root: {
    marginTop: "15px",
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
  textField:{
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  formControl: {
    margin: theme.spacing(3),
  },
  halfTextField: {
    width: "70%"
  },
}));



function FeedbackContainer(props){
  const classes = useStyles();
  const [formError, setFormError] = React.useState(false);
  const [helperText, setHelperText] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [feedback, setFeedback] = React.useState("");
  const [sending, setSending] = React.useState(false);

  function publishFeedbackToMQTT(){
    setSending(true)
    function onConnect() {
      var message = new Message(JSON.stringify({feedback: feedback, email: email}));
      message.destinationName = "pioreactor/feedback"
      message.qos = 1;
      message.retained = true;
      client.publish(message);
      setSending(false)
    }

    var client = new Client(
        "mqtt.pioreactor.com", 9001, "/", "feedback" + Math.random()
    )
    client.connect({onSuccess: onConnect});

  }

  function onSubmit(e) {
    e.preventDefault();
    if (email === ""){
      setFormError(true)
      setHelperText("Can't be blank.")
      return
    }
    publishFeedbackToMQTT()
  }

  const onEmailChange = (e) => {
    setEmail(e.target.value)
  }
  const onFeedbackChange = (e) => {
    setFeedback(e.target.value)
  }

  return(
    <React.Fragment>
      <div>
        <Typography variant="h5" component="h2">
          <Box fontWeight="fontWeightBold">
            Share feedback
          </Box>
        </Typography>
      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
        <p>
        Include your email, and we may get back to you with some questions or advice about your provided feedback.
        We appreciate all feedback sent to us!
        </p>
        <FormGroup>
        <Grid container spacing={1}>
          <Grid item xs={12} md={6}>
            <TextField
              error={formError}
              id="email"
              type="email"
              label="Email"
              required
              onChange={onEmailChange}
              className={`${classes.halfTextField} ${classes.textField}`}
              value={email}
              helperText={helperText}
              />
          </Grid>
          <Grid item xs={12} md={12}>
            <TextField
              label="What went wrong? What went right? What are you unsure about?"
              maxRows={4}
              multiline
              required
              onChange={onFeedbackChange}
              value={feedback}
              className={classes.textField}
              minRows={3}
              fullWidth={true}
            />
          </Grid>

          <Grid item xs={12} md={12}>
            <LoadingButton
              loading={sending}
              variant="contained"
              color="primary"
              onClick={onSubmit}>
              Send
            </LoadingButton>
          </Grid>
          </Grid>
        </FormGroup>



        </CardContent>
      </Card>
    </React.Fragment>
)}


function Feedback(props) {
    React.useEffect(() => {
      document.title = props.title;
    }, [props.title])
    return (
        <Grid container spacing={3} >
          <Grid item md={12} xs={12}>
            <FeedbackContainer/>
          </Grid>
        </Grid>
    )
}

export default Feedback;

