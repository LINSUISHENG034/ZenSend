import React, { useEffect, useCallback, useState } from 'react';
import { Layout, Card, Button, Space, Table, Pagination, Typography, Modal, message as antdMessage, Tag, Input, Select, Tooltip, Alert } from 'antd'; // Added Alert
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined, FieldTimeOutlined, StopOutlined, BarChartOutlined, CopyOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchCampaigns,
  deleteCampaign,
  sendCampaignNow,
  scheduleCampaign, // We'll need a modal for this
  cancelCampaignSchedule,
  setCampaignsCurrentPage,
  setCampaignsPageSize,
  setCampaignsSearchTerm,
  setCampaignsFilters,
  selectAllCampaigns,
  selectCampaignsPagination,
  selectCampaignsLoading,
  selectCampaignsError,
  selectCampaignsSearchTerm,
  selectCampaignsFilters,
  // selectCampaignsSubmitting, // For action buttons loading state
} from '../store/slices/campaignsSlice';
import { format } from 'date-fns';

const { Header, Content } = Layout;
const { Title } = Typography;
const { confirm } = Modal;
const { Search } = Input;
const { Option } = Select;

// Define campaign statuses and their colors
const campaignStatusColors = {
  draft: 'default',
  scheduled: 'blue',
  sending: 'processing', // Ant Design 'processing' gives a spinning effect
  sent: 'success',
  failed: 'error',
  sent_with_errors: 'warning',
  queued: 'geekblue',
  cancelled: 'volcano'
  // Add more as needed by your backend
};

const campaignStatusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'queued', label: 'Queued' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sending', label: 'Sending' },
    { value: 'sent', label: 'Sent' },
    { value: 'sent_with_errors', label: 'Sent with Errors' },
    { value: 'failed', label: 'Failed' },
    { value: 'cancelled', label: 'Cancelled' },
];


const CampaignsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const campaigns = useSelector(selectAllCampaigns);
  const pagination = useSelector(selectCampaignsPagination);
  const isLoading = useSelector(selectCampaignsLoading);
  const error = useSelector(selectCampaignsError);
  const currentSearchTerm = useSelector(selectCampaignsSearchTerm);
  const currentFilters = useSelector(selectCampaignsFilters);
  // const isSubmitting = useSelector(selectCampaignsSubmitting); // For button loading

  const [localSearch, setLocalSearch] = useState(currentSearchTerm);


  const loadCampaigns = useCallback(() => {
    dispatch(fetchCampaigns({
      page: pagination.currentPage,
      pageSize: pagination.pageSize,
      search: currentSearchTerm,
      filters: currentFilters,
    }));
  }, [dispatch, pagination.currentPage, pagination.pageSize, currentSearchTerm, currentFilters]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  const handleCreateCampaign = () => {
    navigate('/campaigns/new');
  };

  const handleEditCampaign = (campaignId) => {
    navigate(`/campaigns/edit/${campaignId}`);
  };

  const handleViewReport = (campaignId) => {
    antdMessage.info(`Analytics for campaign ${campaignId} coming in a future sprint!`);
    // navigate(`/campaigns/report/${campaignId}`);
  };

  const handleCloneCampaign = (campaignId) => {
      antdMessage.info(`Clone campaign ${campaignId} - to be implemented if time permits.`);
      // Logic to fetch campaign data, clear its ID/status, and navigate to /campaigns/new with prefilled data
  };

  const handleDelete = (campaignId) => {
    confirm({
      title: 'Are you sure you want to delete this campaign?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      onOk: async () => {
        const result = await dispatch(deleteCampaign(campaignId));
        if (deleteCampaign.fulfilled.match(result)) {
          antdMessage.success('Campaign deleted successfully.');
          loadCampaigns(); // Refresh
        } else {
          antdMessage.error(result.payload || 'Failed to delete campaign.');
        }
      },
    });
  };

  const handleSendNow = (campaignId) => {
     confirm({
      title: 'Send this campaign immediately?',
      content: 'The campaign will be queued for sending to all recipients.',
      okText: 'Yes, Send Now',
      onOk: async () => {
        const result = await dispatch(sendCampaignNow(campaignId));
        if (sendCampaignNow.fulfilled.match(result)) {
          antdMessage.success('Campaign is being sent!');
          // Backend should update status, list will refresh or update via fulfilled action
        } else {
          antdMessage.error(result.payload || 'Failed to send campaign.');
        }
      },
    });
  };

  const handleCancelSchedule = (campaignId) => {
     confirm({
      title: 'Cancel scheduled sending?',
      content: 'The campaign will be moved back to draft status.',
      okText: 'Yes, Cancel Schedule',
      onOk: async () => {
        const result = await dispatch(cancelCampaignSchedule(campaignId));
        if (cancelCampaignSchedule.fulfilled.match(result)) {
          antdMessage.success('Campaign schedule cancelled.');
        } else {
          antdMessage.error(result.payload || 'Failed to cancel schedule.');
        }
      },
    });
  };


  const handlePaginationChange = (page, pageSize) => {
    dispatch(setCampaignsCurrentPage(page));
    if (pageSize !== pagination.pageSize) {
      dispatch(setCampaignsPageSize(pageSize));
    }
  };

  const handleSearchDebounced = useCallback(
    (value) => { // Basic debounce example
      const timer = setTimeout(() => {
        dispatch(setCampaignsSearchTerm(value));
      }, 500);
      return () => clearTimeout(timer);
    },
    [dispatch]
  );

  const onSearchChange = (e) => {
      setLocalSearch(e.target.value);
      handleSearchDebounced(e.target.value);
  };

  const handleFilterChange = (value) => {
    dispatch(setCampaignsFilters({ status: value }));
  };


  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', width: 250, ellipsis: true },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => <Tag color={campaignStatusColors[status] || 'default'}>{status ? status.replace(/_/g, ' ').toUpperCase() : 'N/A'}</Tag>
    },
    {
      title: 'Recipients',
      dataIndex: 'recipient_group', // Assuming recipient_group is an object like { type: "all_contacts" } or { type: "specific_ids", count: X }
      key: 'recipients',
      width: 150,
      ellipsis: true,
      render: (group) => {
        if (!group) return 'N/A';
        if (group.type === 'all_contacts') return 'All Contacts';
        if (group.type === 'specific_ids' && group.ids) return `${group.ids.length} specific contacts`;
        return typeof group === 'string' ? group : JSON.stringify(group); // Fallback for other formats
      }
    },
    {
      title: 'Template',
      dataIndex: ['template', 'name'], // Access nested property: campaign.template.name
      key: 'template',
      width: 150,
      ellipsis: true,
      render: (name) => name || 'N/A'
    },
    { title: 'Created At', dataIndex: 'created_at', key: 'created_at', width: 180, render: (text) => format(new Date(text), 'PPpp') },
    { title: 'Sent At', dataIndex: 'sent_at', key: 'sent_at', width: 180, render: (text) => text ? format(new Date(text), 'PPpp') : 'N/A' },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit Campaign">
            <Button icon={<EditOutlined />} onClick={() => handleEditCampaign(record.id)} disabled={['sending', 'sent'].includes(record.status)} />
          </Tooltip>
          <Tooltip title="Delete Campaign">
            <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} disabled={['sending'].includes(record.status)} />
          </Tooltip>
          <Tooltip title="View Report">
            <Button icon={<BarChartOutlined />} onClick={() => handleViewReport(record.id)} disabled={!['sent', 'sent_with_errors'].includes(record.status)} />
          </Tooltip>
          {/* Conditional Actions */}
          {['draft', 'failed', 'cancelled'].includes(record.status) && (
            <Tooltip title="Send Now">
              <Button icon={<SendOutlined />} onClick={() => handleSendNow(record.id)} />
            </Tooltip>
          )}
          {/* Placeholder for Schedule button - would open a modal to set date/time */}
          {/* {['draft', 'failed'].includes(record.status) && (
            <Tooltip title="Schedule">
              <Button icon={<FieldTimeOutlined />} onClick={() => antdMessage.info('Schedule functionality via modal to be added.')} />
            </Tooltip>
          )} */}
          {record.status === 'scheduled' && (
             <Tooltip title="Cancel Schedule">
              <Button icon={<StopOutlined />} onClick={() => handleCancelSchedule(record.id)} />
            </Tooltip>
          )}
           <Tooltip title="Clone Campaign">
            <Button icon={<CopyOutlined />} onClick={() => handleCloneCampaign(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Campaigns</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateCampaign}>
          Create Campaign
        </Button>
      </Header>
      <Content style={{ margin: '24px 16px 0' }}>
        <Card>
          <Space style={{ marginBottom: 16, flexWrap: 'wrap' }}>
            <Search
              placeholder="Search campaigns..."
              value={localSearch}
              onChange={onSearchChange}
              style={{ width: 300 }}
              allowClear
            />
            <Select
              value={currentFilters.status}
              onChange={handleFilterChange}
              style={{ width: 200 }}
              placeholder="Filter by status"
            >
              {campaignStatusOptions.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>
          </Space>

          {error && <Alert message="Error fetching campaigns" description={error} type="error" showIcon closable style={{ marginBottom: 16 }} />}

          <Table
            columns={columns}
            dataSource={campaigns}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            scroll={{ x: 1200 }}
            style={{ marginTop: 20 }}
          />

          {pagination.totalCampaigns > 0 && (
            <Pagination
                current={pagination.currentPage}
                pageSize={pagination.pageSize}
                total={pagination.totalCampaigns}
                onChange={handlePaginationChange}
                showSizeChanger
                style={{ marginTop: 20, textAlign: 'right' }}
                disabled={isLoading}
            />
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default CampaignsPage;
