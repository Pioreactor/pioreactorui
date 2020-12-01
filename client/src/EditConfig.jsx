import React from "react";
import { Component, useState } from "react";

import Grid from '@material-ui/core/Grid';
import { makeStyles } from '@material-ui/core/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import Button from '@material-ui/core/Button';
import {Typography} from '@material-ui/core';
import Snackbar from '@material-ui/core/Snackbar';

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


const highlight = editor => {
  let code = editor.textContent;
  code = code.replace(/\((\w+?)(\b)/g, '(<font color="#8a2be2">$1</font>$2');
  editor.innerHTML = code;
};


class EditableCodeDiv extends React.Component {
  constructor(props) {
    super(props);
    this.state = {code: "", openSnackbar: false};
    this.saveCurrentCode = this.saveCurrentCode.bind(this);

  }

  async getData() {
    await fetch("/get_current_config")
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
        body: JSON.stringify({code :this.state.code}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
    .then(res => {
      this.setState({openSnackbar: true});
    })
  }

  componentDidMount() {
    this.getData()
  }

  getCodeFlaskRef = (codeFlask) => {
    this.codeFlask = codeFlask
  }

  onChange = (code) => {
    this.setState({ code })
  }

  handleSnackbarClose = () => {
    this.setState({openSnackbar: false});
  };

  render() {
    return (
      <div>
        <div style={{margin: "10px auto 10px auto", position: "relative", width: "98%", height: "320px", border: "1px solid #ccc"}}>
          <CodeFlaskReact
            code={this.state.code}
            onChange={this.onChange}
            editorRef={this.getCodeFlaskRef}
            language={"python"}
          />
        </div>
        <Button color="primary" variant="contained" onClick={this.saveCurrentCode}> Save </Button>
        <Snackbar
          anchorOrigin={{vertical: "bottom", horizontal: "center"}}
          open={this.state.openSnackbar}
          onClose={this.handleSnackbarClose}
          message={"config.ini saved"}
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
        <p style={{maxWidth: "100%"}}>Update the <code>config.ini</code> file on the leader pioreactor. After syncing, this will be deployed to all the pioreactor units. For some configs (the like <code>dashboard</code> configs), the leader may need to be restarted.</p>
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

