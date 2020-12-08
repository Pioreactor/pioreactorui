import React from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import {Typography} from '@material-ui/core';
import Snackbar from '@material-ui/core/Snackbar';
import Select from '@material-ui/core/Select';

import { CodeFlaskReact } from "react-codeflask"

import Header from "./components/Header"


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
    };
    this.saveCurrentCode = this.saveCurrentCode.bind(this);
    this.availableConfigs = [
      {name: "shared config.ini", filename: "config.ini"},
      {name: "1 unit_config.ini", filename: "config1.ini"},
      {name: "2 unit_config.ini", filename: "config2.ini"},
      {name: "3 unit_config.ini", filename: "config3.ini"},

    ]
  }

  async getData(filename) {
    await fetch("/get_config/" + filename)
      .then(response => {
        return response.text();
      })
      .then(text => {
        this.setState({code: text});
      })
  }

  saveCurrentCode() {
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
      this.setState({openSnackbar: true});
    })
  }

  componentDidMount() {
    this.getData(this.state.filename)
  }

  onSelectionChange = (e) => {
    this.setState({filename: e.target.value})
    this.getData(e.target.value)
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
    return (
      <div>
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
          {this.availableConfigs.map((v) => {
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
          Save
        </Button>
        <Snackbar
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
          open={this.state.openSnackbar}
          onClose={this.handleSnackbarClose}
          message={this.state.snackbarMsg}
          autoHideDuration={2000}
          key={"snackbar"}
        />
      </div>
    )
  }
}




function EditConfigContainer(){
  const classes = useStyles();

  return(
    <Card className={classes.root}>
      <CardContent className={classes.cardContent}>
        <Typography variant="h5" component="h2">
          Edit config.ini
        </Typography>
        <p>Update the <code>config.ini</code> files. The shared <code>config.ini</code> will be deployed to <em>all</em> units, but can be overwritten with a specific unit's <code>config.ini</code>. <a href="https://github.com/Pioreactor/pioreactor/wiki/Configuration">Learn more about Pioreactor configuration</a>.</p>
        <EditableCodeDiv/>
      </CardContent>
    </Card>
)}


function EditConfig() {
    return (
        <Grid container spacing={2} >
          <Grid item xs={12}><Header /></Grid>

          <Grid item md={2} xs={false}/>
          <Grid item md={8} xs={12}>
             <EditConfigContainer/>
          </Grid>
          <Grid item md={2} xs={false}/>

        </Grid>
    )
}

export default EditConfig;

