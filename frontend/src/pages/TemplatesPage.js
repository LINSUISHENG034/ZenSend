import React, { useEffect, useCallback } from 'react';
import { Layout, Card, Button, Space, Table, Pagination, Typography, Modal, message as antdMessage, Alert } from 'antd'; // Added Alert
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  fetchTemplates,
  deleteTemplate,
  setTemplatesCurrentPage,
  setTemplatesPageSize,
  selectAllTemplates,
  selectTemplatesPagination,
  selectTemplatesLoading,
  selectTemplatesError,
  // selectTemplatesSubmitting, // If needed for delete button loading state
} from '../store/slices/templatesSlice';
import { format } from 'date-fns';

const { Header, Content } = Layout;
const { Title } = Typography;
const { confirm } = Modal;

const TemplatesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const templates = useSelector(selectAllTemplates);
  const pagination = useSelector(selectTemplatesPagination);
  const isLoading = useSelector(selectTemplatesLoading);
  const error = useSelector(selectTemplatesError);
  // const isSubmitting = useSelector(selectTemplatesSubmitting); // For delete button loading

  const loadTemplates = useCallback(() => {
    dispatch(fetchTemplates({ page: pagination.currentPage, pageSize: pagination.pageSize }));
  }, [dispatch, pagination.currentPage, pagination.pageSize]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleAddTemplate = () => {
    navigate('/templates/new');
  };

  const handleEditTemplate = (templateId) => {
    navigate(`/templates/edit/${templateId}`);
  };

  const handleDeleteTemplate = (templateId) => {
    confirm({
      title: 'Are you sure you want to delete this template?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Delete',
      okType: 'danger',
      cancelText: 'No, Cancel',
      onOk: async () => {
        const resultAction = await dispatch(deleteTemplate(templateId));
        if (deleteTemplate.fulfilled.match(resultAction)) {
          antdMessage.success('Template deleted successfully');
          // If current page becomes empty after delete, go to previous page or first page
          if (templates.length === 1 && pagination.currentPage > 1) {
            dispatch(setTemplatesCurrentPage(pagination.currentPage - 1)); // This will trigger useEffect to refetch
          } else {
            loadTemplates(); // Re-fetch templates for the current page
          }
        } else {
           antdMessage.error(resultAction.payload || 'Failed to delete template.');
        }
      },
    });
  };

  const handlePaginationChange = (page, pageSize) => {
    dispatch(setTemplatesCurrentPage(page));
    if (pageSize !== pagination.pageSize) {
      dispatch(setTemplatesPageSize(pageSize));
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name', width: 250 },
    { title: 'Subject', dataIndex: 'subject', key: 'subject', ellipsis: true },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => text ? format(new Date(text), 'PPpp') : 'N/A',
    },
    {
      title: 'Updated At',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text) => text ? format(new Date(text), 'PPpp') : 'N/A',
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="middle">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEditTemplate(record.id)} />
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDeleteTemplate(record.id)} />
        </Space>
      ),
    },
  ];

  return (
    <Layout>
      <Header style={{ backgroundColor: 'white', padding: '0 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Email Templates</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddTemplate}>
          Create Template
        </Button>
      </Header>
      <Content style={{ margin: '24px 16px 0' }}>
        <Card>
          {/* Add Search/Filter controls here if needed in future */}
          {error && <Alert message="Error fetching templates" description={typeof error === 'object' ? JSON.stringify(error) : error} type="error" showIcon closable style={{ marginBottom: 16 }} />}

          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={isLoading}
            pagination={false} // Use custom pagination below
            scroll={{ x: 800 }}
            style={{ marginTop: 20 }}
          />

          {pagination.totalTemplates > 0 && (
            <Pagination
                current={pagination.currentPage}
                pageSize={pagination.pageSize}
                total={pagination.totalTemplates}
                onChange={handlePaginationChange}
                showSizeChanger
                onShowSizeChange={handlePaginationChange} // Antd calls onChange with (current, size)
                style={{ marginTop: 20, textAlign: 'right' }}
                disabled={isLoading}
            />
          )}
        </Card>
      </Content>
    </Layout>
  );
};

export default TemplatesPage;
