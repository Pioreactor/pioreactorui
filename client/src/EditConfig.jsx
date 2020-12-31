import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import {Typography} from '@material-ui/core';
import Snackbar from '@material-ui/core/Snackbar';
import Select from '@material-ui/core/Select';
import CircularProgress from '@material-ui/core/CircularProgress';

import { CodeFlaskReact } from "react-codeflask"

import Header from "./components/Header"
import TactileButtonNotification from "./components/TactileButtonNotification";


const useStyles = makeStyles((theme) => ({
  root: {
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



class EditableCodeDiv extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      code: "",
      openSnackbar: false,
      filename: "config.ini",
      snackbarMsg: "",
      isRunning: false,
      availableConfigs: [
        {name: "shared config.ini", filename: "config.ini"},
      ]
    };
    this.saveCurrentCode = this.saveCurrentCode.bind(this);
  }

  async getConfig(filename) {
    await fetch("/get_config/" + filename)
      .then(response => {
        return response.text();
      })
      .then(text => {
        this.setState({code: text});
      })
  }

  async getListOfConfigFiles(filename) {
    await fetch("/get_config")
      .then(response => {
        return response.json();
      })
      .then(json => {
        this.setState(prevState => ({
          availableConfigs: [...prevState.availableConfigs, ...json.filter(e => (e !== 'config.ini')).map(e => ({name: e, filename: e}))]
        }));
      })
  }

  saveCurrentCode() {
    this.setState({isRunning: true})
    fetch('/save_new_config',{
        method: "POST",
        body: JSON.stringify({code :this.state.code, filename: this.state.filename}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    .then(res => {
      if (res.ok) {
        this.setState({snackbarMsg: this.state.filename + " saved and synced."})
      } else {
        this.setState({snackbarMsg: "Hm. Something when wrong saving or syncing..."})
      }
      this.setState({openSnackbar: true, isRunning: false});
    })
  }

  componentDidMount() {
    this.getConfig(this.state.filename)
    this.getListOfConfigFiles()
  }

  onSelectionChange = (e) => {
    this.setState({filename: e.target.value})
    this.getConfig(e.target.value)
  }

  getCodeFlaskRef = (codeFlask) => {
    this.codeFlask = codeFlask
  }

  onTextChange = (code) => {
    this.setState({code: code})
  }

  handleSnackbarClose = () => {
    this.setState({openSnackbar: false});
  };

  render() {
    const runningFeedback = this.state.isRunning ? <CircularProgress color="inherit" size={25}/> : "Save"
    return (
      <>
        <Select
          style={{margin: "10px 10px 10px 10px"}}
          native
          value={this.state.filename}
          onChange={this.onSelectionChange}
          inputProps={{
            name: 'config',
            id: 'config',
          }}
        >
          {this.state.availableConfigs.map((v) => {
            return <option key={v.filename} value={v.filename}>{v.name}</option>
            }
          )}
        </Select>

        <div style={{letterSpacing: "0em", margin: "10px auto 10px auto", position: "relative", width: "98%", height: "300px", border: "1px solid #ccc"}}>
          <CodeFlaskReact
            code={this.state.code}
            onChange={this.onTextChange}
            editorRef={this.getCodeFlaskRef}
            language={"python"}
          />
        </div>
        <Button
          style={{margin: "5px 10px 5px 10px"}}
          color="primary"
          variant="contained"
          onClick={this.saveCurrentCode}
          disabled={false}>
          {runningFeedback}
        </Button>
        <Snackbar
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
          open={this.state.openSnackbar}
          onClose={this.handleSnackbarClose}
          message={this.state.snackbarMsg}
          autoHideDuration={2000}
          key={"edit-config-snackbar"}
        />
      </>
    )
  }
}




function EditConfigContainer(){
  const classes = useStyles();

  return(
    <>
      <div>
        <div>
          <Typography variant="h5" component="h2">
            <Box fontWeight="fontWeightBold">
              Edit config.ini
            </Box>
          </Typography>
        </div>
      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <p>Update the <code>config.ini</code> files. The shared <code>config.ini</code> will be deployed to <em>all</em> Pioreactors, but can be overwritten with a specific Pioreactor's <code>config.ini</code>. <a href="https://github.com/Pioreactor/pioreactor/wiki/Configuration-via-config.ini" target="_blank">Learn more about Pioreactor configuration</a>.</p>
          <EditableCodeDiv/>
        </CardContent>
      </Card>
    </>
)}


function EditConfig() {
    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>
          <Grid item md={12} xs={1}/>
          <Grid item md={12} xs={1}/>

          <Grid item md={1} xs={1}/>
          <Grid item md={10} xs={12}>
             <EditConfigContainer/>
          </Grid>
          <Grid item md={1} xs={1}/>
        </Grid>
    )
}

export default EditConfig;

