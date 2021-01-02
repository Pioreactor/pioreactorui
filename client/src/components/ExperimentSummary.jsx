import React from 'react'
import {makeStyles} from '@material-ui/styles';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/Card';
import {Typography} from '@material-ui/core';
import moment from "moment";
import Box from '@material-ui/core/Box';
import Snackbar from '@material-ui/core/Snackbar';
import Divider from '@material-ui/core/Divider';
import Button from '@material-ui/core/Button';
import ContentEditable from 'react-contenteditable'
import CalendarTodayIcon from '@material-ui/icons/CalendarToday';
import TimelapseIcon from '@material-ui/icons/Timelapse';
import GetAppIcon from '@material-ui/icons/GetApp';
import AddIcon from '@material-ui/icons/Add';

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
    this.state = {desc: "", openSnackBar: false, originalDesc: ""};
  };

  componentDidUpdate(prevProps) {
    if (this.props.description !== prevProps.description) {
      this.setState({desc: `${this.props.description}`, originalDesc: `${this.props.description}`})
    }
  }

  handleChange = evt => {
    this.setState({desc: evt.target.value});
  };

  onBlur = evt => {
    if (this.state.desc !== this.state.originalDesc) {
      this.setState({originalDesc: this.state.desc})
      return fetch('update_experiment_desc', {
          method: "POST",
          body: JSON.stringify({experiment : this.props.experiment, description: this.state.desc}),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }).then(res => {
          if (res.status === 200){
            this.setState({openSnackBar: true});
          }
        })
    }
  };

  handleSnackbarClose = (e, reason) => {
    if (reason !== "clickaway"){
      this.setState({openSnackBar: false});
    }
  };

  render = () => {
    return (
      <div style={{"padding": "0px 5px 0px 5px"}}>
        <Box fontWeight="fontWeightBold">
          Description:
        </Box>
        <ContentEditable
            innerRef={this.contentEditable}
            html={this.state.desc} // innerHTML of the editable div
            disabled={false}       // use true to disable editing
            onChange={this.handleChange} // handle innerHTML change
            onBlur={this.onBlur}
            tagName="p"
            style={{"padding": "3px 3px 3px 2px"}}
          />
          <Snackbar
            anchorOrigin={{vertical: "bottom", horizontal: "center"}}
            open={this.state.openSnackBar}
            onClose={this.handleSnackbarClose}
            message={"Updated description"}
            autoHideDuration={2500}
            key={"snackbarEditDesc"}
          />
      </div>
    )
  };
};


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
            <Button href="/download-data" style={{textTransform: 'none', marginRight: "0px", float: "right"}} color="primary">
              <GetAppIcon className={classes.textIcon}/> Download experiment data
            </Button>
            <Button href="/start-new-experiment" style={{textTransform: 'none', float: "right", marginRight: "10px"}} color="primary">
              <AddIcon className={classes.textIcon}/> New experiment
            </Button>
          </div>
        </div>

        <Divider/>
        <Typography variant="subtitle2">
          <Box fontWeight="fontWeightBold" style={{margin: "10px 2px 10px 2px", display:"inline-block"}}>
            <CalendarTodayIcon style={{ fontSize: 12, verticalAlign: "middle" }}/> Experiment Started:
          </Box>
          <Box fontWeight="fontWeightRegular" style={{marginRight: "20px", display:"inline-block"}}>
            <span title={moment(startedAt).format("YYYY-MM-DD HH:mm:ss")}>{moment(startedAt).format("dddd, MMMM D YYYY")}</span>
          </Box>
          <Box fontWeight="fontWeightBold" style={{display:"inline-block", margin: "10px 2px 10px 0px"}}>
            <TimelapseIcon style={{ fontSize: 12, verticalAlign: "middle"  }}/>Time Elapsed:
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
