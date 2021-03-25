import React from 'react'
import {makeStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import moment from "moment";
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import ContentEditable from 'react-contenteditable'
import CalendarTodayIcon from '@material-ui/icons/CalendarToday';
import TimelapseIcon from '@material-ui/icons/Timelapse';
import GetAppIcon from '@material-ui/icons/GetApp';
import AddIcon from '@material-ui/icons/Add';
import DialogTitle from '@material-ui/core/DialogTitle';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

const useStyles = makeStyles({
  title: {
    fontSize: 14,
  },
  cardContent: {
    padding: "10px"
  },
  pos: {
    marginBottom: 0,
  },
  textIcon: {
    fontSize: 15,
    verticalAlign: "middle",
    margin: "0px 3px"
  },
});



class EditableDescription extends React.Component {
  constructor(props) {
    super(props)
    this.contentEditable = React.createRef();
    this.state = {
      desc: "",
    };
  };

  componentDidUpdate(prevProps) {
    if (this.props.description !== prevProps.description) {
      this.setState({desc: this.props.description})
    }
  }

  handleChange = evt => {
    this.setState({desc: evt.target.value});
    return fetch('update_experiment_desc', {
        method: "POST",
        body: JSON.stringify({experiment : this.props.experiment, description: evt.target.value}),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(res => {
        if (res.status !== 200){
          console.log("didn't save")
        }
      })
  };


  render = () => {
    return (
      <div style={{padding: "0px 5px 0px 5px"}}>
        <Box fontWeight="fontWeightBold">
          Description:
        </Box>
        <ContentEditable
            innerRef={this.contentEditable}
            html={this.state.desc} // innerHTML of the editable div
            disabled={false}
            onChange={this.handleChange} // handle innerHTML change
            onBlur={this.onBlur}
            tagName="p"
            style={{padding: "3px 3px 3px 2px", outline: "none"}}
          />
      </div>
    )
  };
};


function ButtonConfirmNewExperimentDialog() {
  const classes = useStyles();
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };

  const onConfirm = () => {
    fetch("/stop_all", {method: "POST"})
    handleClose()
  }

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      <Button style={{textTransform: 'none', float: "right", marginRight: "10px"}} color="primary" onClick={handleClickOpen}>
        <AddIcon className={classes.textIcon}/> New experiment
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">Starting a new experiment</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Starting a new experiment will stop data collection for the current experiment. Do you wish to proceed?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button href="/start-new-experiment" color="primary">
            Confirm
          </Button>
          <Button onClick={handleClose} color="secondary" autoFocus>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
}



function ExperimentSummary(props){
  const classes = useStyles();
  const experiment = props.experimentMetadata.experiment || ""
  const startedAt = props.experimentMetadata.timestamp || moment()
  const desc = props.experimentMetadata.description || ""

  return(
    <React.Fragment>
      <div>
        <div style={{display: "flex", justifyContent: "space-between", marginBottom: "5px"}}>
          <Typography variant="h5" component="h1">
            <Box fontWeight="fontWeightBold">
              {experiment}
            </Box>
          </Typography>
          <div >
            <Button href="/export-data" style={{textTransform: 'none', marginRight: "0px", float: "right"}} color="primary">
              <GetAppIcon className={classes.textIcon}/> Export experiment data
            </Button>

            <ButtonConfirmNewExperimentDialog/>
          </div>
        </div>

        <Divider/>
        <Typography variant="subtitle2">
          <Box fontWeight="fontWeightBold" style={{margin: "10px 2px 10px 2px", display:"inline-block"}}>
            <CalendarTodayIcon style={{ fontSize: 12, verticalAlign: "middle" }}/> Experiment started:
          </Box>
          <Box fontWeight="fontWeightRegular" style={{marginRight: "20px", display:"inline-block"}}>
            <span title={moment(startedAt).format("YYYY-MM-DD HH:mm:ss")}>{moment(startedAt).format("dddd, MMMM D YYYY")}</span>
          </Box>
          <Box fontWeight="fontWeightBold" style={{display:"inline-block", margin: "10px 2px 10px 0px"}}>
            <TimelapseIcon style={{ fontSize: 12, verticalAlign: "middle"  }}/>Time elapsed:
          </Box>
          <Box fontWeight="fontWeightRegular" style={{display:"inline-block"}}>
           {(moment().diff(moment(startedAt), 'H'))}h
          </Box>
        </Typography>
      </div>
      <Card className={classes.root}>
        <CardContent className={classes.cardContent}>
          <EditableDescription experiment={experiment} description={desc} />
        </CardContent>
      </Card>
    </React.Fragment>
  )
}


export default ExperimentSummary;
